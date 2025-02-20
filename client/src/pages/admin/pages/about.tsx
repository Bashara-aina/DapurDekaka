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

interface Feature {
  id: string;
  title: string;
  description: string;
  image: string;
}

interface AboutContent {
  title: string;
  description: string;
  mainImage: string;
  mainDescription: string;
  sections: {
    title: string;
    description: string;
  }[];
  features: Feature[];
}

export default function AboutEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [content, setContent] = useState<AboutContent>({
    title: "",
    description: "",
    mainImage: "",
    mainDescription: "",
    sections: [
      {
        title: "",
        description: ""
      }
    ],
    features: [
      { id: "premium", title: "", description: "", image: "" },
      { id: "handmade", title: "", description: "", image: "" },
      { id: "halal", title: "", description: "", image: "" },
      { id: "preservative", title: "", description: "", image: "" }
    ]
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
                <label className="block text-sm font-medium mb-1">Main Description</label>
                <Textarea
                  value={content.mainDescription}
                  onChange={(e) => setContent({ ...content, mainDescription: e.target.value })}
                  placeholder="Enter main description"
                  rows={6}
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

              <div>
                <label className="block text-sm font-medium mb-1">Section Title</label>
                <Input
                  value={content.sections[0]?.title}
                  onChange={(e) => setContent({
                    ...content,
                    sections: [{ ...content.sections[0], title: e.target.value }]
                  })}
                  placeholder="Enter section title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Section Description</label>
                <Textarea
                  value={content.sections[0]?.description}
                  onChange={(e) => setContent({
                    ...content,
                    sections: [{ ...content.sections[0], description: e.target.value }]
                  })}
                  placeholder="Enter section description"
                  rows={4}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Features</h3>
                {content.features.map((feature, index) => (
                  <div key={feature.id} className="space-y-2 p-4 border rounded-lg">
                    <Input
                      value={feature.title}
                      onChange={(e) => {
                        const newFeatures = [...content.features];
                        newFeatures[index] = { ...feature, title: e.target.value };
                        setContent({ ...content, features: newFeatures });
                      }}
                      placeholder="Feature title"
                    />
                    <Textarea
                      value={feature.description}
                      onChange={(e) => {
                        const newFeatures = [...content.features];
                        newFeatures[index] = { ...feature, description: e.target.value };
                        setContent({ ...content, features: newFeatures });
                      }}
                      placeholder="Feature description"
                      rows={3}
                    />
                    <Input
                      value={feature.image}
                      onChange={(e) => {
                        const newFeatures = [...content.features];
                        newFeatures[index] = { ...feature, image: e.target.value };
                        setContent({ ...content, features: newFeatures });
                      }}
                      placeholder="Feature image URL"
                    />
                  </div>
                ))}
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