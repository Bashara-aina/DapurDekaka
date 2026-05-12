import Link from 'next/link';
import { MessageCircle } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-[#1A1A1A] text-brand-cream/80 pt-12 pb-32 md:pb-12">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div>
            <h3 className="font-display text-xl font-semibold text-brand-cream mb-4">Dapur Dekaka 德卡</h3>
            <p className="text-sm">Jl. Sinom V no. 7, Turangga, Bandung</p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-brand-cream mb-4">Menu</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/products" className="hover:text-brand-cream">Produk</Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-brand-cream">Blog</Link>
              </li>
              <li>
                <Link href="/b2b" className="hover:text-brand-cream">B2B</Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-brand-cream mb-4">Bantuan</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/orders/DDK-TEST-0001" className="hover:text-brand-cream">Lacak Pesanan</Link>
              </li>
              <li>
                <a
                  href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`}
                  className="hover:text-brand-cream"
                >
                  WhatsApp
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-brand-cream mb-4">Ikuti Kami</h4>
            <div className="flex gap-4">
              <a
                href="https://instagram.com/dapurdekaka"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-brand-cream"
                aria-label="Instagram"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4 4 2.209 1.791 4 4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a
                href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-brand-cream"
              >
                <MessageCircle className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm">© 2026 Dapur Dekaka. All rights reserved.</p>
          <div className="flex gap-4 text-xs">
            <span>Halal</span>
            <span>•</span>
            <span>Frozen Fresh</span>
            <span>•</span>
            <span>Nationwide Delivery</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
