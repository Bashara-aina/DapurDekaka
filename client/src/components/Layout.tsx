import { Footer } from "./Footer";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Your existing header/navigation would go here */}
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
