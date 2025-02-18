
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

const pages = [
  { id: 'home', title: 'Homepage', description: 'Edit homepage content and featured sections' },
  { id: 'about', title: 'About Page', description: 'Update company information and story' },
  { id: 'menu', title: 'Menu Page', description: 'Manage menu items and categories' },
  { id: 'contact', title: 'Contact Page', description: 'Edit contact information and form' }
];

import AdminNavbar from "@/components/layout/admin-navbar";

export default function AdminPages() {
  const [, setLocation] = useLocation();
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
    cacheTime: 0,
    onError: () => {
      setLocation('/auth');
    }
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
      <h1 className="text-3xl font-bold mb-6">Page Management</h1>
      <div className="grid md:grid-cols-2 gap-6">
        {pages.map((page) => (
          <Link key={page.id} href={`/admin/pages/${page.id}`}>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>{page.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{page.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
    </>
  );
}
