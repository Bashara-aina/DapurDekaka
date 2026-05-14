'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Plus, Trash2, Upload, X } from 'lucide-react';
import Image from 'next/image';
import { useState, useCallback } from 'react';
import TiptapEditor from '@/components/admin/blog/TiptapEditor';

interface ProductFormProps {
  initialData?: {
    id?: string;
    categoryId?: string;
    nameId?: string;
    nameEn?: string;
    slug?: string;
    descriptionId?: string;
    descriptionEn?: string;
    shortDescriptionId?: string;
    shortDescriptionEn?: string;
    weightGram?: number;
    isHalal?: boolean;
    isActive?: boolean;
    isFeatured?: boolean;
    isB2bAvailable?: boolean;
    isPreOrder?: boolean;
    sortOrder?: number;
    metaTitleId?: string;
    metaTitleEn?: string;
    metaDescriptionId?: string;
    metaDescriptionEn?: string;
    shopeeUrl?: string;
    variants?: VariantData[];
    images?: ImageData[];
  };
  categories: { id: string; nameId: string }[];
  onSubmit: (data: ProductFormData) => Promise<void>;
  isSubmitting?: boolean;
}

interface VariantData {
  id?: string;
  nameId: string;
  nameEn: string;
  sku: string;
  price: number;
  b2bPrice: number;
  stock: number;
  weightGram: number;
  isActive: boolean;
}

interface ImageData {
  id?: string;
  cloudinaryUrl: string;
  cloudinaryPublicId: string;
  altTextId?: string;
  altTextEn?: string;
  sortOrder?: number;
}

const ProductSchema = z.object({
  categoryId: z.string().min(1, 'Kategori wajib dipilih'),
  nameId: z.string().min(1, 'Nama Indonesia wajib diisi').max(255),
  nameEn: z.string().min(1, 'Nama English wajib diisi').max(255),
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/, 'Slug hanya huruf kecil, angka, dan strip'),
  descriptionId: z.string().optional(),
  descriptionEn: z.string().optional(),
  shortDescriptionId: z.string().max(500).optional(),
  shortDescriptionEn: z.string().max(500).optional(),
  weightGram: z.number().int().nonnegative().default(0),
  isHalal: z.boolean().default(true),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isB2bAvailable: z.boolean().default(true),
  isPreOrder: z.boolean().default(false),
  sortOrder: z.number().int().nonnegative().default(0),
  metaTitleId: z.string().max(255).optional(),
  metaTitleEn: z.string().max(255).optional(),
  metaDescriptionId: z.string().max(500).optional(),
  metaDescriptionEn: z.string().max(500).optional(),
  shopeeUrl: z.string().url('URL tidak valid').optional().or(z.literal('')),
  variants: z.array(z.object({
    id: z.string().optional(),
    nameId: z.string().min(1, 'Nama varian wajib diisi'),
    nameEn: z.string().min(1, 'Nama EN varian wajib diisi'),
    sku: z.string().min(1, 'SKU wajib diisi'),
    price: z.number().int().nonnegative('Harga harus bilangan bulat'),
    b2bPrice: z.number().int().nonnegative('Harga B2B harus bilangan bulat'),
    stock: z.number().int().nonnegative('Stok harus bilangan bulat'),
    weightGram: z.number().int().nonnegative(),
    isActive: z.boolean().default(true),
  })).min(1, 'Minimal harus ada 1 varian'),
  images: z.array(z.object({
    id: z.string().optional(),
    cloudinaryUrl: z.string().min(1, 'URL gambar wajib diisi'),
    cloudinaryPublicId: z.string().min(1),
    altTextId: z.string().optional(),
    altTextEn: z.string().optional(),
    sortOrder: z.number().int().optional(),
  })).optional(),
});

export type ProductFormData = z.infer<typeof ProductSchema>;

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function formatIDR(num: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
}

export function ProductForm({ initialData, categories, onSubmit, isSubmitting }: ProductFormProps) {
  const [images, setImages] = useState<ImageData[]>(initialData?.images ?? []);
  const [uploading, setUploading] = useState(false);
  const [descriptionId, setDescriptionId] = useState(initialData?.descriptionId ?? '');
  const [descriptionEn, setDescriptionEn] = useState(initialData?.descriptionEn ?? '');

  const form = useForm<ProductFormData>({
    resolver: zodResolver(ProductSchema),
    defaultValues: {
      categoryId: initialData?.categoryId ?? '',
      nameId: initialData?.nameId ?? '',
      nameEn: initialData?.nameEn ?? '',
      slug: initialData?.slug ?? '',
      descriptionId: initialData?.descriptionId ?? '',
      descriptionEn: initialData?.descriptionEn ?? '',
      shortDescriptionId: initialData?.shortDescriptionId ?? '',
      shortDescriptionEn: initialData?.shortDescriptionEn ?? '',
      weightGram: initialData?.weightGram ?? 0,
      isHalal: initialData?.isHalal ?? true,
      isActive: initialData?.isActive ?? true,
      isFeatured: initialData?.isFeatured ?? false,
      isB2bAvailable: initialData?.isB2bAvailable ?? true,
      isPreOrder: initialData?.isPreOrder ?? false,
      sortOrder: initialData?.sortOrder ?? 0,
      metaTitleId: initialData?.metaTitleId ?? '',
      metaTitleEn: initialData?.metaTitleEn ?? '',
      metaDescriptionId: initialData?.metaDescriptionId ?? '',
      metaDescriptionEn: initialData?.metaDescriptionEn ?? '',
      shopeeUrl: initialData?.shopeeUrl ?? '',
      variants: initialData?.variants?.length ? initialData.variants : [{
        nameId: '', nameEn: '', sku: '', price: 0, b2bPrice: 0, stock: 0, weightGram: 0, isActive: true,
      }],
    },
  });

  const { fields: variantFields, append: appendVariant, remove: removeVariant } = useFieldArray({
    control: form.control,
    name: 'variants',
  });

  const handleNameIdChange = (value: string) => {
    form.setValue('nameId', value);
    if (!initialData?.slug) {
      form.setValue('slug', generateSlug(value));
    }
  };

  const handleImageUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'products');

      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
      const result = await res.json();

      if (!result.success) throw new Error(result.error);

      const newImage: ImageData = {
        cloudinaryUrl: result.data.url,
        cloudinaryPublicId: result.data.publicId,
        sortOrder: images.length,
      };
      setImages(prev => [...prev, newImage]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload gagal');
    } finally {
      setUploading(false);
    }
  }, [images.length]);

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  async function handleSubmit(data: ProductFormData) {
    const payload = {
      ...data,
      descriptionId,
      descriptionEn,
      images,
    };
    await onSubmit(payload as ProductFormData);
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
      {/* Basic Info */}
      <div className="bg-white rounded-lg border border-admin-border p-6 space-y-6">
        <h2 className="font-semibold text-gray-700">Info Dasar</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="categoryId">Kategori *</Label>
            <select
              id="categoryId"
              {...form.register('categoryId')}
              className="w-full h-10 px-3 rounded-md border border-input bg-white text-sm"
            >
              <option value="">Pilih Kategori</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.nameId}</option>
              ))}
            </select>
            {form.formState.errors.categoryId && (
              <p className="text-sm text-red-500">{form.formState.errors.categoryId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug *</Label>
            <Input
              id="slug"
              {...form.register('slug')}
              placeholder="dimsum-crabstick"
              className="lowercase"
            />
            {form.formState.errors.slug && (
              <p className="text-sm text-red-500">{form.formState.errors.slug.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="nameId">Nama (Bahasa Indonesia) *</Label>
            <Input
              id="nameId"
              value={form.watch('nameId')}
              onChange={e => handleNameIdChange(e.target.value)}
              placeholder="Dimsum Crabstick"
            />
            {form.formState.errors.nameId && (
              <p className="text-sm text-red-500">{form.formState.errors.nameId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="nameEn">Nama (English) *</Label>
            <Input id="nameEn" {...form.register('nameEn')} placeholder="Crabstick Dimsum" />
            {form.formState.errors.nameEn && (
              <p className="text-sm text-red-500">{form.formState.errors.nameEn.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="weightGram">Berat (gram)</Label>
            <Input
              id="weightGram"
              type="number"
              {...form.register('weightGram', { valueAsNumber: true })}
              placeholder="150"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sortOrder">Sort Order</Label>
            <Input
              id="sortOrder"
              type="number"
              {...form.register('sortOrder', { valueAsNumber: true })}
              placeholder="0"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Deskripsi (Bahasa Indonesia)</Label>
            <TiptapEditor content={descriptionId} onChange={setDescriptionId} />
          </div>
          <div className="space-y-2">
            <Label>Description (English)</Label>
            <TiptapEditor content={descriptionEn} onChange={setDescriptionEn} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="shortDescriptionId">Short Description (ID)</Label>
            <textarea
              id="shortDescriptionId"
              {...form.register('shortDescriptionId')}
              className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-white text-sm"
              placeholder="Deskripsi singkat produk"
              maxLength={500}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shortDescriptionEn">Short Description (EN)</Label>
            <textarea
              id="shortDescriptionEn"
              {...form.register('shortDescriptionEn')}
              className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-white text-sm"
              placeholder="Brief product description"
              maxLength={500}
            />
          </div>
        </div>
      </div>

      {/* Images */}
      <div className="bg-white rounded-lg border border-admin-border p-6 space-y-4">
        <h2 className="font-semibold text-gray-700">Gambar Produk</h2>

        <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
          <input
            type="file"
            accept="image/*"
            id="image-upload"
            className="hidden"
            disabled={uploading}
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
              e.target.value = '';
            }}
          />
          <label htmlFor="image-upload" className="cursor-pointer">
            <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">
              {uploading ? 'Mengupload...' : 'Klik untuk upload gambar (JPG, PNG, WebP)'}
            </p>
          </label>
        </div>

        {images.length > 0 && (
          <div className="flex gap-3 flex-wrap">
            {images.map((img, idx) => (
              <div key={idx} className="relative w-24 h-24 rounded-lg bg-brand-cream overflow-hidden group">
                <Image src={img.cloudinaryUrl} alt={img.altTextId ?? ''} fill className="object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
                {idx === 0 && (
                  <span className="absolute bottom-1 left-1 bg-brand-red text-white text-xs px-1 rounded">Utama</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Variants */}
      <div className="bg-white rounded-lg border border-admin-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-700">Varian Produk</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => appendVariant({ nameId: '', nameEn: '', sku: '', price: 0, b2bPrice: 0, stock: 0, weightGram: 0, isActive: true })}
          >
            <Plus className="w-4 h-4 mr-1" /> Tambah Varian
          </Button>
        </div>

        <div className="space-y-4">
          {variantFields.map((field, idx) => (
            <div key={field.id} className="border border-admin-border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Varian {idx + 1}</span>
                {variantFields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeVariant(idx)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`variants.${idx}.nameId`}>Nama Varian (ID) *</Label>
                  <Input
                    id={`variants.${idx}.nameId`}
                    {...form.register(`variants.${idx}.nameId`)}
                    placeholder="Reguler"
                  />
                  {form.formState.errors.variants?.[idx]?.nameId && (
                    <p className="text-sm text-red-500">{String(form.formState.errors.variants[idx]?.nameId?.message)}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`variants.${idx}.nameEn`}>Nama Varian (EN) *</Label>
                  <Input
                    id={`variants.${idx}.nameEn`}
                    {...form.register(`variants.${idx}.nameEn`)}
                    placeholder="Regular"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`variants.${idx}.sku`}>SKU *</Label>
                  <Input
                    id={`variants.${idx}.sku`}
                    {...form.register(`variants.${idx}.sku`)}
                    placeholder="DDK-001"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`variants.${idx}.weightGram`}>Berat (gram)</Label>
                  <Input
                    id={`variants.${idx}.weightGram`}
                    type="number"
                    {...form.register(`variants.${idx}.weightGram`, { valueAsNumber: true })}
                    placeholder="150"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`variants.${idx}.price`}>Harga Jual (IDR) *</Label>
                  <Input
                    id={`variants.${idx}.price`}
                    type="number"
                    {...form.register(`variants.${idx}.price`, { valueAsNumber: true })}
                    placeholder="25000"
                  />
                  {form.formState.errors.variants?.[idx]?.price && (
                    <p className="text-sm text-red-500">{String(form.formState.errors.variants[idx]?.price?.message)}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`variants.${idx}.b2bPrice`}>Harga B2B (IDR) *</Label>
                  <Input
                    id={`variants.${idx}.b2bPrice`}
                    type="number"
                    {...form.register(`variants.${idx}.b2bPrice`, { valueAsNumber: true })}
                    placeholder="20000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`variants.${idx}.stock`}>Stok *</Label>
                  <Input
                    id={`variants.${idx}.stock`}
                    type="number"
                    {...form.register(`variants.${idx}.stock`, { valueAsNumber: true })}
                    placeholder="100"
                  />
                </div>

                <div className="flex items-center pt-6">
                  <div className="flex items-center space-y-2">
                    <Switch
                      id={`variants.${idx}.isActive`}
                      checked={form.watch(`variants.${idx}.isActive`)}
                      onCheckedChange={(checked) => form.setValue(`variants.${idx}.isActive`, checked)}
                    />
                    <Label htmlFor={`variants.${idx}.isActive`}>Aktif</Label>
                  </div>
                </div>
              </div>

              {form.watch(`variants.${idx}.price`) > 0 && (
                <p className="text-xs text-gray-400">
                  Harga display: {formatIDR(form.watch(`variants.${idx}.price`))}
                </p>
              )}
            </div>
          ))}
        </div>
        {form.formState.errors.variants?.message && (
          <p className="text-sm text-red-500">{form.formState.errors.variants.message}</p>
        )}
      </div>

      {/* Toggles */}
      <div className="bg-white rounded-lg border border-admin-border p-6">
        <h2 className="font-semibold text-gray-700 mb-4">Pengaturan</h2>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center space-y-2">
            <Switch
              id="isHalal"
              checked={form.watch('isHalal')}
              onCheckedChange={(checked) => form.setValue('isHalal', checked)}
            />
            <Label htmlFor="isHalal" className="ml-2">Halal</Label>
          </div>

          <div className="flex items-center space-y-2">
            <Switch
              id="isActive"
              checked={form.watch('isActive')}
              onCheckedChange={(checked) => form.setValue('isActive', checked)}
            />
            <Label htmlFor="isActive" className="ml-2">Aktif</Label>
          </div>

          <div className="flex items-center space-y-2">
            <Switch
              id="isFeatured"
              checked={form.watch('isFeatured')}
              onCheckedChange={(checked) => form.setValue('isFeatured', checked)}
            />
            <Label htmlFor="isFeatured" className="ml-2">Unggulan</Label>
          </div>

          <div className="flex items-center space-y-2">
            <Switch
              id="isB2bAvailable"
              checked={form.watch('isB2bAvailable')}
              onCheckedChange={(checked) => form.setValue('isB2bAvailable', checked)}
            />
            <Label htmlFor="isB2bAvailable" className="ml-2">Tersedia B2B</Label>
          </div>

          <div className="flex items-center space-y-2">
            <Switch
              id="isPreOrder"
              checked={form.watch('isPreOrder')}
              onCheckedChange={(checked) => form.setValue('isPreOrder', checked)}
            />
            <Label htmlFor="isPreOrder" className="ml-2">Pre-Order</Label>
          </div>
        </div>
      </div>

      {/* SEO */}
      <div className="bg-white rounded-lg border border-admin-border p-6 space-y-4">
        <h2 className="font-semibold text-gray-700">SEO</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="metaTitleId">Meta Title (ID)</Label>
            <Input id="metaTitleId" {...form.register('metaTitleId')} placeholder="Meta title untuk SEO" maxLength={255} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="metaTitleEn">Meta Title (EN)</Label>
            <Input id="metaTitleEn" {...form.register('metaTitleEn')} placeholder="SEO meta title" maxLength={255} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="metaDescriptionId">Meta Description (ID)</Label>
            <textarea
              id="metaDescriptionId"
              {...form.register('metaDescriptionId')}
              className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-white text-sm"
              placeholder="Meta description untuk SEO"
              maxLength={500}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="metaDescriptionEn">Meta Description (EN)</Label>
            <textarea
              id="metaDescriptionEn"
              {...form.register('metaDescriptionEn')}
              className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-white text-sm"
              placeholder="SEO meta description"
              maxLength={500}
            />
          </div>
        </div>
      </div>

      {/* Shopee URL */}
      <div className="bg-white rounded-lg border border-admin-border p-6 space-y-4">
        <h2 className="font-semibold text-gray-700">Marketplace</h2>
        <div className="space-y-2 max-w-md">
          <Label htmlFor="shopeeUrl">Shopee URL (opsional)</Label>
          <Input
            id="shopeeUrl"
            {...form.register('shopeeUrl')}
            placeholder="https://shopee.co.id/..."
            type="url"
          />
        </div>
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={isSubmitting} className="bg-brand-red hover:bg-brand-red-dark">
          {isSubmitting ? 'Menyimpan...' : initialData?.id ? 'Update Produk' : 'Buat Produk'}
        </Button>
      </div>
    </form>
  );
}