'use client';

import { Menu } from 'lucide-react';
import { useState } from 'react';

export function AdminHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-admin-border px-6 flex items-center justify-between">
      <div>
        <h1 className="font-semibold text-lg">Admin Dashboard</h1>
      </div>

      <div className="flex items-center gap-4">
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 hover:bg-admin-content"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
