import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2 } from "lucide-react";
import AdminNavbar from "@/components/layout/admin-navbar";
import type { PageContent } from "@shared/schema";

interface Feature {
  id: string;
  title: string;
  description: string;
  image: string;
}

interface Section {
  id: string;
  title: string;
  description: string;
  image: string;
}

interface AboutContent {
  title: string;
  description: string;
  mainImage: string;
  sections: Section[];
  features: Feature[];
}

export default function AboutEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [content, setContent] = useState<AboutContent>({
    title: "",
    description: "",
    mainImage: "",
    sections: [
      {
        id: "main",
        title: "Why Choose Us",
        description: "",
        image: ""
      }
    ],
    features: [
      { id: "premium", title: "", description: "", image: "" },
      { id: "handmade", title: "", description: "", image: "" },
      { id: "halal", title: "", description: "", image: "" },
      { id: "preservative", title: "", description: "", image: "" }
    ]
  });

  const { data: pageData, isLoading: dataLoading, error: fetchError } = useQuery({
    queryKey: ["/api/pages/about"],
    queryFn: async () => {
      const response = await fetch("/api/pages/about");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch about content");
      }
      const data = await response.json();
      return data as PageContent;
    },
    retry: (failureCount, error) => {
      return failureCount < 2 && error instanceof Error && !error.message.includes("invalid response");
    },
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
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ content: formData }),
        credentials: "include"
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
        variant: "destructive"
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateMutation.mutateAsync(content);
    } catch (error) {
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
              {/* Main Content */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Main Image</label>
                  <div className="flex gap-4 items-start">
                    <Input
                      value={content.mainImage}
                      onChange={(e) => setContent({ ...content, mainImage: e.target.value })}
                      placeholder="Enter image URL"
                      className="flex-1"
                    />
                    {content.mainImage && (
                      <img
                        src={content.mainImage}
                        alt="Preview"
                        className="w-20 h-20 object-cover rounded"
                        onError={(e) => {
                          e.currentTarget.src = "https://placehold.co/64x64/png?text=Invalid+Image";
                        }}
                      />
                    )}
                  </div>
                </div>

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
              </div>

              {/* Sections */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Sections</h3>
                {content.sections.map((section, index) => (
                  <Card key={section.id}>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Section Image</label>
                          <div className="flex gap-4 items-start">
                            <Input
                              value={section.image}
                              onChange={(e) => {
                                const newSections = [...content.sections];
                                newSections[index] = { ...section, image: e.target.value };
                                setContent({ ...content, sections: newSections });
                              }}
                              placeholder="Enter image URL"
                              className="flex-1"
                            />
                            {section.image && (
                              <img
                                src={section.image}
                                alt="Preview"
                                className="w-20 h-20 object-cover rounded"
                                onError={(e) => {
                                  e.currentTarget.src = "https://placehold.co/64x64/png?text=Invalid+Image";
                                }}
                              />
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-1">Section Title</label>
                          <Input
                            value={section.title}
                            onChange={(e) => {
                              const newSections = [...content.sections];
                              newSections[index] = { ...section, title: e.target.value };
                              setContent({ ...content, sections: newSections });
                            }}
                            placeholder="Enter section title"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-1">Section Description</label>
                          <Textarea
                            value={section.description}
                            onChange={(e) => {
                              const newSections = [...content.sections];
                              newSections[index] = { ...section, description: e.target.value };
                              setContent({ ...content, sections: newSections });
                            }}
                            placeholder="Enter section description"
                            rows={3}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Features */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Features</h3>
                {content.features.map((feature, index) => (
                  <Card key={feature.id}>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Feature Image</label>
                          <div className="flex gap-4 items-start">
                            <Input
                              value={feature.image}
                              onChange={(e) => {
                                const newFeatures = [...content.features];
                                newFeatures[index] = { ...feature, image: e.target.value };
                                setContent({ ...content, features: newFeatures });
                              }}
                              placeholder="Enter image URL"
                              className="flex-1"
                            />
                            {feature.image && (
                              <img
                                src={feature.image}
                                alt="Preview"
                                className="w-20 h-20 object-cover rounded"
                                onError={(e) => {
                                  e.currentTarget.src = "https://placehold.co/64x64/png?text=Invalid+Image";
                                }}
                              />
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-1">Feature Title</label>
                          <Input
                            value={feature.title}
                            onChange={(e) => {
                              const newFeatures = [...content.features];
                              newFeatures[index] = { ...feature, title: e.target.value };
                              setContent({ ...content, features: newFeatures });
                            }}
                            placeholder="Enter feature title"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-1">Feature Description</label>
                          <Textarea
                            value={feature.description}
                            onChange={(e) => {
                              const newFeatures = [...content.features];
                              newFeatures[index] = { ...feature, description: e.target.value };
                              setContent({ ...content, features: newFeatures });
                            }}
                            placeholder="Enter feature description"
                            rows={3}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
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