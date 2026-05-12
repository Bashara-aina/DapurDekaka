import { Navbar } from '@/components/store/layout/Navbar';
import { BottomNav } from '@/components/store/layout/BottomNav';
import { Footer } from '@/components/store/layout/Footer';
import { WhatsAppButton } from '@/components/store/layout/WhatsAppButton';

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pb-20 md:pb-0">{children}</main>
      <Footer />
      <WhatsAppButton />
      <BottomNav />
    </>
  );
}
