import { Link } from "wouter";
import { Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import AdminLayout from "@/components/layout/AdminLayout";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function AdminDashboard() {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useLanguage();

  if (isLoading) {
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
    <AdminLayout>
      <h1 className="text-3xl font-bold mb-6">{t("admin.dashboard.title")}</h1>
      <div className="grid md:grid-cols-2 gap-6">
        <Link href="/admin/pages">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>{t("admin.dashboard.pages")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{t("admin.index.managePages")}</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/blog">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>{t("admin.dashboard.blog")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{t("admin.index.manageBlog")}</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </AdminLayout>
  );
}