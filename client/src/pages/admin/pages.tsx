import { Link } from "wouter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import AdminLayout from "@/components/layout/AdminLayout";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const pages = [
  { id: 'home', titleKey: 'admin.pages.home', descriptionKey: 'admin.pages.homeDesc' },
  { id: 'about', titleKey: 'admin.pages.about', descriptionKey: 'admin.pages.aboutDesc' },
  { id: 'menu', titleKey: 'admin.pages.menu', descriptionKey: 'admin.pages.menuDesc' },
  { id: 'contact', titleKey: 'admin.pages.contact', descriptionKey: 'admin.pages.contactDesc' }
];

export default function AdminPages() {
  const { isLoading } = useAuth();
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <AdminLayout>
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
              <CardTitle>{t('admin.pages.customers')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{t('admin.pages.customersDesc')}</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </AdminLayout>
  );
}