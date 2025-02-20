import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import AdminNavbar from "@/components/layout/admin-navbar";

type FeatureCard = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
};

type AboutContent = {
  title: string;
  description: string;
  whyChooseTitle: string;
  whyChooseDescription: string;
  mainImage: string;
  features: FeatureCard[];
};

export default function AboutEditor() {
  const { toast } = useToast();
  const [content, setContent] = useState<AboutContent>({
    title: "",
    description: "",
    whyChooseTitle: "",
    whyChooseDescription: "",
    mainImage: "",
    features: [
      { id: "premium", title: "", description: "", imageUrl: "" },
      { id: "handmade", title: "", description: "", imageUrl: "" },
      { id: "halal", title: "", description: "", imageUrl: "" },
      { id: "preservative", title: "", description: "", imageUrl: "" },
    ],
  });

  const { isLoading, isError } = useQuery({
    queryKey: ["/api/pages/about"],
    queryFn: async () => {
      const response = await fetch("/api/pages/about");
      if (!response.ok) throw new Error("Failed to fetch about content");
      const data = await response.json();
      setContent(data);
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (formData: AboutContent) => {
      const response = await fetch("/api/pages/about", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to update about page");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "About page updated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFeatureChange = (index: number, field: keyof FeatureCard, value: string) => {
    const newFeatures = [...content.features];
    newFeatures[index] = { ...newFeatures[index], [field]: value };
    setContent({ ...content, features: newFeatures });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(content);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">Error loading about page content</div>
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
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Main Image URL</label>
                  <Input
                    value={content.mainImage}
                    onChange={(e) => setContent({ ...content, mainImage: e.target.value })}
                    placeholder="Enter main image URL"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    value={content.title}
                    onChange={(e) => setContent({ ...content, title: e.target.value })}
                    placeholder="Enter title"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={content.description}
                    onChange={(e) => setContent({ ...content, description: e.target.value })}
                    placeholder="Enter description"
                    rows={4}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Why Choose Section Title</label>
                  <Input
                    value={content.whyChooseTitle}
                    onChange={(e) => setContent({ ...content, whyChooseTitle: e.target.value })}
                    placeholder="Enter 'Why Choose' section title"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Why Choose Section Description</label>
                  <Textarea
                    value={content.whyChooseDescription}
                    onChange={(e) => setContent({ ...content, whyChooseDescription: e.target.value })}
                    placeholder="Enter 'Why Choose' section description"
                    rows={4}
                  />
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Feature Cards</h3>
                  {content.features.map((feature, index) => (
                    <Card key={feature.id}>
                      <CardContent className="pt-6 space-y-4">
                        <div>
                          <label className="text-sm font-medium">Feature {index + 1} Image URL</label>
                          <Input
                            value={feature.imageUrl}
                            onChange={(e) => handleFeatureChange(index, "imageUrl", e.target.value)}
                            placeholder="Enter feature image URL"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Feature {index + 1} Title</label>
                          <Input
                            value={feature.title}
                            onChange={(e) => handleFeatureChange(index, "title", e.target.value)}
                            placeholder="Enter feature title"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Feature {index + 1} Description</label>
                          <Textarea
                            value={feature.description}
                            onChange={(e) => handleFeatureChange(index, "description", e.target.value)}
                            placeholder="Enter feature description"
                            rows={3}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
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