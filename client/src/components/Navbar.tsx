
import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { MarketplaceDialog } from "./MarketplaceDialog";

export function Navbar() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/">
            <a className="flex items-center gap-2">
              <img src="/logo/logo.png" alt="Logo" className="h-12 w-auto" />
            </a>
          </Link>
          
          <div className="flex items-center gap-4">
            <Link href="/menu">
              <a className="text-sm font-medium">Menu</a>
            </Link>
            <Button onClick={() => setDialogOpen(true)}>Pesan Sekarang</Button>
          </div>
        </div>
      </div>
      <MarketplaceDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </nav>
  );
}
