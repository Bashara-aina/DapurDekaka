import { db } from '@/lib/db';
import { categories } from '@/lib/db/schema';
import { asc, eq } from 'drizzle-orm';
import { ProductForm } from '@/components/admin/products/ProductForm';
import type { ProductFormData } from '@/components/admin/products/ProductForm';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }
  const role = (session.user as { role?: string }).role;
  if (!role || !['superadmin', 'owner'].includes(role)) {
    redirect('/admin/products');
  }

  const allCategories = await db.query.categories.findMany({
    where: eq(categories.isActive, true),
    orderBy: [asc(categories.sortOrder)],
  });

  async function handleSubmit(data: ProductFormData) {
    const session = await auth();
    if (!session?.user) throw new Error('Unauthorized');

    const res = await fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create product');
    }

    redirect('/admin/products');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tambah Produk Baru</h1>

      <ProductForm
        categories={allCategories.map(c => ({ id: c.id, nameId: c.nameId }))}
        onSubmit={handleSubmit}
      />
    </div>
  );
}