import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function B2BAccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login?callbackUrl=/b2b/account');
  }

  const role = session.user.role;
  if (role !== 'b2b' && role !== 'superadmin') {
    redirect('/b2b');
  }

  return <>{children}</>;
}