import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { data: isAuthenticated, isLoading: authLoading, isError } = useQuery({
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
    if (!authLoading && (isError || !isAuthenticated)) {
      setLocation('/auth');
    }
  }, [authLoading, isAuthenticated, isError, setLocation]);

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
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid md:grid-cols-2 gap-6">
        <a href="/admin/pages">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Page Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Manage website pages and content</p>
            </CardContent>
          </Card>
        </a>
        <a href="/admin/blog">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Blog Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Manage blog posts and articles</p>
            </CardContent>
          </Card>
        </a>
      </div>
    </div>
  );
}