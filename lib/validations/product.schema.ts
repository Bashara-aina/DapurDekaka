import { z } from 'zod';

const indonesianPhone = z
  .string()
  .regex(/^(\+62|62|0)[0-9]{8,13}$/, 'Masukkan nomor HP yang valid')
  .transform((val) => {
    if (val.startsWith('+62')) return '0' + val.slice(3);
    if (val.startsWith('62')) return '0' + val.slice(2);
    return val;
  });

export const productVariantSchema = z.object({
  nameId: z.string().min(1, 'Nama Indonesia wajib diisi').max(100),
  nameEn: z.string().min(1, 'Nama English wajib diisi').max(100),
  sku: z.string().min(1, 'SKU wajib diisi').max(100),
  price: z.number().int('Harga harus bilangan bulat').positive('Harga harus positif'),
  b2bPrice: z.number().int().positive().nullable().optional(),
  stock: z.number().int('Stok harus bilangan bulat').min(0, 'Stok tidak boleh negatif'),
  weightGram: z.number().int('Berat harus bilangan bulat').positive('Berat harus positif'),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const createProductSchema = z.object({
  categoryId: z.string().uuid('ID kategori tidak valid'),
  nameId: z.string().min(2, 'Nama Indonesia minimal 2 karakter').max(255),
  nameEn: z.string().min(2, 'Nama English minimal 2 karakter').max(255),
  slug: z
    .string()
    .min(2, 'Slug minimal 2 karakter')
    .max(255)
    .regex(/^[a-z0-9-]+$/, 'Slug hanya boleh huruf kecil, angka, dan strip'),
  descriptionId: z.string().optional(),
  descriptionEn: z.string().optional(),
  shortDescriptionId: z.string().max(500).optional(),
  shortDescriptionEn: z.string().max(500).optional(),
  weightGram: z.number().int().positive(),
  isHalal: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isB2bAvailable: z.boolean().default(true),
  isPreOrder: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  metaTitleId: z.string().max(255).optional(),
  metaTitleEn: z.string().max(255).optional(),
  metaDescriptionId: z.string().max(500).optional(),
  metaDescriptionEn: z.string().max(500).optional(),
  shopeeUrl: z.string().url().optional().or(z.literal('')),
  variants: z.array(productVariantSchema).min(1, 'Minimal harus ada 1 varian'),
});

export const updateProductSchema = createProductSchema.partial().extend({
  variants: z.array(productVariantSchema.extend({
    id: z.string().uuid().optional(),
  })).optional(),
});

export const categorySchema = z.object({
  nameId: z.string().min(1, 'Nama Indonesia wajib diisi').max(100),
  nameEn: z.string().min(1, 'Nama English wajib diisi').max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  descriptionId: z.string().optional(),
  descriptionEn: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductVariantInput = z.infer<typeof productVariantSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;