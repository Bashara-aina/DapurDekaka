import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productVariants } from '@/lib/db/schema';
import { asc, eq } from 'drizzle-orm';
import { success, forbidden, serverError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return forbidden('Anda harus login');
    }

    const role = session.user.role;
    if (!role || !['superadmin', 'owner', 'warehouse'].includes(role)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const variants = await db.query.productVariants.findMany({
      orderBy: [asc(productVariants.sku)],
      where: eq(productVariants.isActive, true),
      with: { product: true },
    });

    const rows = [
      'SKU,Product Name,Variant Name,Stock,Weight (g),Price (IDR)',
    ];

    for (const v of variants) {
      rows.push([
        v.sku,
        `"${(v.product?.nameId || '').replace(/"/g, '""')}"`,
        `"${(v.nameId || '').replace(/"/g, '""')}"`,
        v.stock.toString(),
        v.weightGram.toString(),
        v.price.toString(),
      ].join(','));
    }

    const csv = rows.join('\n');
    const date = new Date().toISOString().split('T')[0];

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="inventory-${date}.csv"`,
      },
    });
  } catch (error) {
    console.error('[admin/export/inventory]', error);
    return serverError(error);
  }
}