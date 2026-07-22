import { db } from '@/lib/db';
import { categories } from '@/lib/db/schema';
import { asc, eq } from 'drizzle-orm';
import { ProductForm } from '@/components/admin/products/ProductForm';
import { requireRole } from '@/lib/auth/check-role';

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  await requireRole(['superadmin', 'owner']);

  const allCategories = await db.query.categories.findMany({
    where: eq(categories.isActive, true),
    orderBy: [asc(categories.sortOrder)],
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tambah Produk Baru</h1>

      <ProductForm
        categories={allCategories.map(c => ({ id: c.id, nameId: c.nameId }))}
      />
    </div>
  );
}