import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import AdminNavbar from "@/components/layout/admin-navbar";
import type { PageContent } from "@shared/schema";

interface AboutContent {
  title: string;
  description: string;
  mainImage: string;
}

export default function AboutEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [content, setContent] = useState<AboutContent>({
    title: "",
    description: "",
    mainImage: ""
  });

  const { data: pageData, isLoading } = useQuery({
    queryKey: ["/api/pages/about"],
    queryFn: async () => {
      const response = await fetch("/api/pages/about");
      if (!response.ok) throw new Error("Failed to fetch about content");
      return response.json();
    }
  });

  useEffect(() => {
    if (pageData) {
      setContent(pageData.content as AboutContent);
    }
  }, [pageData]);

  const updateMutation = useMutation({
    mutationFn: async (formData: AboutContent) => {
      const response = await fetch("/api/pages/about", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: formData }),
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to update about page");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages/about"] });
      toast({ title: "Success", description: "About page updated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <AdminNavbar />
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Edit About Page</CardTitle>
          </CardHeader>
          <CardContent>
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                updateMutation.mutate(content);
              }} 
              className="space-y-6"
            >
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <Input
                  value={content.title}
                  onChange={(e) => setContent({ ...content, title: e.target.value })}
                  placeholder="Enter title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <Textarea
                  value={content.description}
                  onChange={(e) => setContent({ ...content, description: e.target.value })}
                  placeholder="Enter description"
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Main Image URL</label>
                <Input
                  value={content.mainImage}
                  onChange={(e) => setContent({ ...content, mainImage: e.target.value })}
                  placeholder="Enter image URL"
                />
              </div>

              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="w-full"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}