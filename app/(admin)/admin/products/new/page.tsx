import { db } from '@/lib/db';
import { categories } from '@/lib/db/schema';
import { asc, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  const allCategories = await db.query.categories.findMany({
    where: eq(categories.isActive, true),
    orderBy: [asc(categories.sortOrder)],
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tambah Produk Baru</h1>

      <div className="bg-white rounded-lg border border-admin-border p-6">
        <p className="text-gray-500 text-sm">
          Form tambah produk akan segera tersedia. Saat ini, tambahkan produk langsung melalui database atau seed script.
        </p>
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Kategori tersedia:</h3>
          <div className="flex flex-wrap gap-2">
            {allCategories.map((cat) => (
              <span key={cat.id} className="inline-flex px-3 py-1 bg-brand-cream text-text-primary text-sm rounded-full">
                {cat.nameId}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
