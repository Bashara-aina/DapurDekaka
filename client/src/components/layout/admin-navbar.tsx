
import { Link } from "wouter";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function AdminNavbar() {
  const { t } = useLanguage();

  return (
    <nav className="bg-white border-b">
      <div className="container mx-auto px-4">
        <div className="h-16 flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/admin">
              <a className="text-lg font-semibold text-gray-900">
                {t("admin.navbar.dashboard")}
              </a>
            </Link>
            <div className="flex space-x-4">
              <Link href="/admin/blog">
                <a className="text-gray-600 hover:text-primary transition-colors">
                  {t("admin.navbar.blog")}
                </a>
              </Link>
              <Link href="/admin/pages">
                <a className="text-gray-600 hover:text-primary transition-colors">
                  {t("admin.navbar.pages")}
                </a>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
