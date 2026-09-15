import type { ReactNode } from 'react';
import { AccountNav } from './AccountNav';

interface AccountLayoutProps {
  children: ReactNode;
}

// Server Component by design: the interactive nav (pathname, sign-out)
// lives in <AccountNav /> so this layout ships zero JS itself and account
// pages are free to move back to RSC one by one.
export default function AccountLayout({ children }: AccountLayoutProps) {
  return (
    <div className="min-h-screen bg-brand-cream pb-20 md:pb-0">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row gap-6">
          <AccountNav />

          {/* Main Content */}
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
