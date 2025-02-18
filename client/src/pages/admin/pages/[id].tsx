
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";

interface PageContent {
  id: string;
  title: string;
  content: Record<string, string>;
  images: Record<string, string>;
}

export default function AdminPageEditor({ params }: { params: { pageId: string } }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editedContent, setEditedContent] = useState<PageContent | null>(null);

  const { data: pageContent, isLoading } = useQuery<PageContent>({
    queryKey: [`/api/pages/${params.pageId}`],
    queryFn: async () => {
      const response = await fetch(`/api/pages/${params.pageId}`);
      if (!response.ok) throw new Error("Failed to fetch page content");
      return response.json();
    },
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

  if (isLoading) {
    return <div>Loading...</div>;
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
    <div className="container mx-auto p-6">
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
    </div>
  );
}
