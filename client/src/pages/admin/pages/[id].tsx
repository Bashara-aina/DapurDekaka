
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useAuth } from "@/hooks/useAuth";
import { AdminPageSkeleton } from "@/components/admin/AdminPageSkeleton";

interface PageContent {
  id: string;
  title: string;
  content: Record<string, string>;
  images: Record<string, string>;
}

export default function AdminPageEditor({ params }: { params: { pageId: string } }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editedContent, setEditedContent] = useState<PageContent | null>(null);

  const { data: pageContent, isLoading, isError } = useQuery<PageContent>({
    queryKey: [`/api/pages/${params.pageId}`],
    queryFn: async () => {
      const response = await fetch(`/api/pages/${params.pageId}`);
      if (!response.ok) throw new Error("Failed to fetch page content");
      return response.json();
    },
    enabled: !!isAuthenticated,
  });

  const updateMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(`/api/pages/${params.pageId}`, {
        method: "PUT",
        body: formData,
        credentials: 'include'
      });
      if (!response.ok) throw new Error("Failed to update page content");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pages/${params.pageId}`] });
      toast({ title: "Success", description: "Page content updated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (authLoading || isLoading) {
    return (
      <AdminLayout>
        <AdminPageSkeleton title="Edit Page" />
      </AdminLayout>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (isError) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground mb-4">Failed to load page content. Please try again.</p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: [`/api/pages/${params.pageId}`] })}>
            Retry
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editedContent) return;

    const formData = new FormData();
    formData.append('content', JSON.stringify(editedContent.content));
    formData.append('images', JSON.stringify(editedContent.images));
    
    updateMutation.mutate(formData);
  };

  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold mb-6">
        Edit {params.pageId.charAt(0).toUpperCase() + params.pageId.slice(1)} Page
      </h1>
      
      <form onSubmit={handleSubmit}>
        <Tabs defaultValue="content">
          <TabsList>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="images">Images</TabsTrigger>
          </TabsList>
          
          <TabsContent value="content">
            <Card className="p-4">
              {pageContent && Object.entries(pageContent.content).map(([key, value]) => (
                <div key={key} className="mb-4">
                  <label className="block text-sm font-medium mb-2">{key}</label>
                  <Textarea
                    value={editedContent?.content[key] || value}
                    onChange={(e) => setEditedContent(prev => ({
                      ...prev!,
                      content: {
                        ...prev!.content,
                        [key]: e.target.value
                      }
                    }))}
                    className="min-h-[100px]"
                  />
                </div>
              ))}
            </Card>
          </TabsContent>
          
          <TabsContent value="images">
            <Card className="p-4">
              {pageContent && Object.entries(pageContent.images).map(([key, value]) => (
                <div key={key} className="mb-4">
                  <label className="block text-sm font-medium mb-2">{key}</label>
                  <Input
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        // Handle image upload
                      }
                    }}
                  />
                  {value && (
                    <img 
                      src={value} 
                      alt={key} 
                      className="mt-2 max-w-[200px]"
                    />
                  )}
                </div>
              ))}
            </Card>
          </TabsContent>
        </Tabs>
        
        <Button type="submit" className="mt-4">
          Save Changes
        </Button>
      </form>
    </AdminLayout>
  );
}
