import { db } from '@/lib/db';
import { productVariants } from '@/lib/db/schema';
import { asc, eq } from 'drizzle-orm';
import InventoryClient from './InventoryClient';
import { requireRole } from '@/lib/auth/check-role';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  await requireRole(['superadmin', 'owner', 'warehouse']);
  const variants = await db.query.productVariants.findMany({
    where: eq(productVariants.isActive, true),
    with: {
      product: true,
    },
    orderBy: [asc(productVariants.stock)],
  });

  const serialized = variants.map((v) => ({
    id: v.id,
    nameId: v.nameId,
    sku: v.sku,
    stock: v.stock,
    productId: v.productId,
    product: {
      id: v.product.id,
      nameId: v.product.nameId,
    },
  }));

  return <InventoryClient initialVariants={serialized} />;
}