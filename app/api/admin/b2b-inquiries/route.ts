import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { b2bInquiries } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { success, serverError } from '@/lib/utils/api-response';

export async function GET() {
  try {
    const inquiries = await db.query.b2bInquiries.findMany({
      orderBy: [desc(b2bInquiries.createdAt)],
    });

    return success(inquiries);
  } catch (error) {
    return serverError(error);
  }
}