import { Link } from "wouter";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Menu" },
  { href: "/about", label: "About" },
  { href: "/articles", label: "Article" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { language, setLanguage } = useLanguage();

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b">
      <div className="container mx-auto px-4">
        <div className="h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <a className="flex items-center">
                <img
                  src="/logo/logo.png"
                  alt="Dapur Dekaka"
                  className="h-12 w-auto"
                />
              </a>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
              className="bg-background/80 backdrop-blur-sm"
            >
              {language.toUpperCase()}
            </Button>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex gap-6">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <a className="text-gray-600 hover:text-primary transition-colors">
                  {item.label}
                </a>
              </Link>
            ))}
            <div className="flex items-center gap-2">
              <Button asChild>
                <a
                  href="https://wa.me/your-number"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Order Now
                </a>
              </Button>
            </div>
          </div>

          {/* Mobile Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <div className="flex flex-col gap-4 mt-8">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <a
                      className="text-lg text-gray-600 hover:text-primary transition-colors"
                      onClick={() => setIsOpen(false)}
                    >
                      {item.label}
                    </a>
                  </Link>
                ))}
                <Button asChild className="mt-4">
                  <a
                    href="https://wa.me/your-number"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsOpen(false)}
                  >
                    Order Now
                  </a>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}