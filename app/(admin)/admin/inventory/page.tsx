import { db } from '@/lib/db';
import { productVariants } from '@/lib/db/schema';
import { asc, eq } from 'drizzle-orm';
import InventoryClient from './InventoryClient';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
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
      nameId: v.product.nameId,
    },
  }));

  return <InventoryClient initialVariants={serialized} />;
}