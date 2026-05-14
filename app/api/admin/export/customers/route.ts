import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { success, forbidden, serverError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { formatWIB } from '@/lib/utils/format-date';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return forbidden('Anda harus login');
    }

    const role = session.user.role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const allUsers = await db.query.users.findMany({
      orderBy: [desc(users.createdAt)],
    });

    const rows = [
      'Name,Email,Phone,Role,Active,Points Balance,Created At',
    ];

    for (const u of allUsers) {
      rows.push([
        `"${(u.name || '').replace(/"/g, '""')}"`,
        u.email,
        u.phone || '',
        u.role,
        u.isActive ? 'Yes' : 'No',
        (u.pointsBalance || 0).toString(),
        formatWIB(u.createdAt),
      ].join(','));
    }

    const csv = rows.join('\n');
    const date = new Date().toISOString().split('T')[0];

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="customers-${date}.csv"`,
      },
    });
  } catch (error) {
    console.error('[admin/export/customers]', error);
    return serverError(error);
  }
}