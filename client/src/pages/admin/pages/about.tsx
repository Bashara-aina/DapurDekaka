import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import AdminNavbar from "@/components/layout/admin-navbar";
import type { InsertAboutPage } from "@shared/schema";

type FeatureCard = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
};

type AboutContent = InsertAboutPage;

export default function AboutEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
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

  const { data: aboutData, isLoading: dataLoading, error: fetchError } = useQuery({
    queryKey: ["/api/pages/about"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/pages/about", {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });
        
        const contentType = response.headers.get("content-type");
        if (!contentType?.includes("application/json")) {
          throw new Error("Server returned non-JSON response");
        }

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch about content");
        }

        return response.json();
      } catch (error) {
        console.error("Fetch error:", error);
        throw error;
      }
    },
    retry: (failureCount, error) => {
      return failureCount < 2 && error instanceof Error && !error.message.includes("invalid response");
    },
  });

  useEffect(() => {
    if (aboutData) {
      setContent(aboutData);
    }
  }, [aboutData]);

  const updateMutation = useMutation({
    mutationFn: async (formData: AboutContent) => {
      const response = await fetch("/api/pages/about", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update about page");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages/about"] });
      toast({ 
        title: "Success", 
        description: "About page updated successfully" 
      });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!content.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Title is required",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateMutation.mutateAsync(content);
    } catch (error) {
      // Error is handled by mutation error callback
      console.error("Submission error:", error);
    }
  };

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">
          Error loading about page content: {fetchError instanceof Error ? fetchError.message : "Unknown error"}
        </div>
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
                <div className="space-y-2">
                  <label className="text-sm font-medium">Main Image URL</label>
                  <div className="flex gap-4 items-start">
                    <div className="flex-1">
                      <Input
                        value={content.mainImage}
                        onChange={(e) => setContent({ ...content, mainImage: e.target.value })}
                        placeholder="Enter main image URL"
                        className="w-full"
                      />
                    </div>
                    {content.mainImage && (
                      <div className="w-32 h-32 rounded-lg overflow-hidden bg-gray-100">
                        <img
                          src={content.mainImage}
                          alt="Main"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = "https://placehold.co/128x128/png?text=Invalid+Image";
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    value={content.title}
                    onChange={(e) => setContent({ ...content, title: e.target.value })}
                    placeholder="Enter title"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={content.description}
                    onChange={(e) => setContent({ ...content, description: e.target.value })}
                    placeholder="Enter description"
                    rows={4}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Why Choose Section Title</label>
                  <Input
                    value={content.whyChooseTitle}
                    onChange={(e) => setContent({ ...content, whyChooseTitle: e.target.value })}
                    placeholder="Enter 'Why Choose' section title"
                  />
                </div>

                <div className="space-y-2">
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
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Feature {index + 1} Image URL</label>
                          <div className="flex gap-4 items-start">
                            <div className="flex-1">
                              <Input
                                value={feature.imageUrl}
                                onChange={(e) => handleFeatureChange(index, "imageUrl", e.target.value)}
                                placeholder="Enter feature image URL"
                              />
                            </div>
                            {feature.imageUrl && (
                              <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100">
                                <img
                                  src={feature.imageUrl}
                                  alt={feature.title}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.src = "https://placehold.co/96x96/png?text=Invalid+Image";
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Feature {index + 1} Title</label>
                          <Input
                            value={feature.title}
                            onChange={(e) => handleFeatureChange(index, "title", e.target.value)}
                            placeholder="Enter feature title"
                          />
                        </div>
                        <div className="space-y-2">
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

              <Button 
                type="submit" 
                disabled={updateMutation.isPending}
                className="w-full"
              >
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