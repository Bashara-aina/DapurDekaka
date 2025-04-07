import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const pages = [
  { id: 'home', titleKey: 'admin.pages.home', descriptionKey: 'admin.pages.homeDesc' },
  { id: 'about', titleKey: 'admin.pages.about', descriptionKey: 'admin.pages.aboutDesc' },
  { id: 'menu', titleKey: 'admin.pages.menu', descriptionKey: 'admin.pages.menuDesc' },
  { id: 'contact', titleKey: 'admin.pages.contact', descriptionKey: 'admin.pages.contactDesc' }
];

import AdminNavbar from "@/components/layout/admin-navbar";

export default function AdminPages() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  const { data: isAuthenticated, isLoading: authLoading } = useQuery({
    queryKey: ['/api/auth-check'],
    queryFn: async () => {
      const response = await fetch('/api/auth-check', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Unauthorized');
      }
      return true;
    },
    retry: false,
    staleTime: 0,
    gcTime: 0
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation('/auth');
    }
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <AdminNavbar />
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">{t('admin.pages.title')}</h1>
        <div className="grid md:grid-cols-2 gap-6">
          {pages.map((page) => (
            <Link key={page.id} href={`/admin/pages/${page.id}`}>
              <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle>{t(page.titleKey)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{t(page.descriptionKey)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        <Link href="/admin/pages/footer">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>{t('admin.pages.footer')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t('admin.pages.footerDesc')}</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/pages/customers">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>Customers Section</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Edit customer testimonials and partner logos</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </>
  );
}