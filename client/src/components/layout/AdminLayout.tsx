import { Loader2 } from "lucide-react";
import AdminNavbar from "./admin-navbar";
import { useAuth } from "@/hooks/useAuth";

interface AdminLayoutProps {
  children: React.ReactNode;
  showNavbar?: boolean;
}

/**
 * Standardized layout wrapper for all admin pages.
 * Handles auth check, loading state, and provides consistent styling.
 */
export default function AdminLayout({ children, showNavbar = true }: AdminLayoutProps) {
  const { isAuthenticated, isLoading } = useAuth();

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {showNavbar && <AdminNavbar />}
      <div className="container mx-auto p-6">
        {children}
      </div>
    </div>
  );
}