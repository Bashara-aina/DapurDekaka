import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { b2bProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { QuoteForm } from '@/components/b2b/QuoteForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Minta Penawaran - B2B Dapur Dekaka',
  description: 'Formulir permintaan penawaran harga untuk pemesanan bisnis dalam jumlah besar.',
};

export default async function B2BQuotePage() {
  const session = await auth();

  if (session?.user?.id) {
    const profile = await db.query.b2bProfiles.findFirst({
      where: eq(b2bProfiles.userId, session.user.id),
    });
    if (profile && !profile.isApproved) {
      redirect('/b2b/account');
    }
  }

  return (
    <div className="bg-brand-cream min-h-screen pb-20">
      {/* Header */}
      <div className="bg-white border-b border-brand-cream-dark py-6 px-4">
        <div className="container mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-xl font-bold">Minta Penawaran</h1>
            <Link href="/b2b/account" className="text-sm text-brand-red hover:underline">
              ← Kembali
            </Link>
          </div>
          <p className="text-text-secondary text-sm mt-1">
            Isi formulir dan tim kami akan menghubungi Anda
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="px-4 py-8 container mx-auto max-w-xl">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <QuoteForm />
        </div>
      </div>
    </div>
  );
}