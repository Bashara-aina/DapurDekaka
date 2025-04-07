import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Info, ImageIcon } from "lucide-react";
import AdminNavbar from "@/components/layout/admin-navbar";
import type { PageContent } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

interface FileUpload {
  mainImage: File | null;
  featureImages: Record<string, File | null>;
}

export default function AboutEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const [files, setFiles] = useState<FileUpload>({
    mainImage: null,
    featureImages: {}
  });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Create FormData if there are files to upload
    if (files.mainImage || Object.values(files.featureImages).some(file => file !== null)) {
      const formData = new FormData();
      
      // Add the content as JSON
      formData.append('content', JSON.stringify(content));
      
      // Add the main image if it exists
      if (files.mainImage) {
        formData.append('mainImage', files.mainImage);
      }
      
      // Add all feature images
      Object.entries(files.featureImages).forEach(([featureId, file]) => {
        if (file) {
          formData.append(`featureImage_${featureId}`, file);
        }
      });
      
      // Call the upload mutation
      uploadMutation.mutate(formData);
    } else {
      // Regular JSON update if no files to upload
      updateMutation.mutate(content);
    }
  };

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

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/pages/about/upload", {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to upload files");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages/about"] });
      toast({ title: "Success", description: "About page updated with file uploads" });
      
      // Reset file inputs after successful upload
      setFiles({
        mainImage: null,
        featureImages: {}
      });
      
      // Reset file input elements
      if (formRef.current) {
        const fileInputs = formRef.current.querySelectorAll('input[type="file"]');
        fileInputs.forEach((input) => {
          if (input instanceof HTMLInputElement) {
            input.value = '';
          }
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleMainImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFiles({ ...files, mainImage: e.target.files[0] });
    }
  };

  const handleFeatureImageChange = (featureId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFiles({
        ...files,
        featureImages: {
          ...files.featureImages,
          [featureId]: e.target.files[0]
        }
      });
    }
  };

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
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Edit About Page</CardTitle>
                <CardDescription className="mt-2">
                  This page lets you edit the content shown on the /about page of your website
                </CardDescription>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={updateMutation.isPending || uploadMutation.isPending}
              >
                {updateMutation.isPending || uploadMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
        </Card>

        <form 
          ref={formRef}
          onSubmit={handleSubmit} 
          className="space-y-6"
        >
          <Tabs defaultValue="general">
            <TabsList className="mb-4">
              <TabsTrigger value="general">General Information</TabsTrigger>
              <TabsTrigger value="features">Features</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            <TabsContent value="general">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-6">
                    {/* Title section */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <label className="block text-sm font-medium">Page Title</label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>This title appears at the top of the About page</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Input
                        value={content.title}
                        onChange={(e) => setContent({ ...content, title: e.target.value })}
                        placeholder="Enter page title"
                      />
                    </div>

                    {/* Main image section */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <label className="block text-sm font-medium">Main Image</label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>This image appears next to the main description</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="border rounded-md p-2 bg-muted/20">
                            <p className="text-xs text-muted-foreground mb-2">Current image:</p>
                            {content.mainImage ? (
                              <div className="relative aspect-video w-full bg-muted overflow-hidden rounded-md">
                                <img 
                                  src={content.mainImage} 
                                  alt="Main about page image" 
                                  className="object-cover w-full h-full" 
                                />
                              </div>
                            ) : (
                              <div className="flex items-center justify-center aspect-video w-full bg-muted rounded-md">
                                <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                              </div>
                            )}
                          </div>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={handleMainImageChange}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Image URL</label>
                          <Input
                            value={content.mainImage}
                            onChange={(e) => setContent({ ...content, mainImage: e.target.value })}
                            placeholder="Enter image URL"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            You can either upload a new image or provide a URL directly
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Main description */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <label className="block text-sm font-medium">Main Description</label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>This is the main text that appears beside the image</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Textarea
                        value={content.mainDescription}
                        onChange={(e) => setContent({ ...content, mainDescription: e.target.value })}
                        placeholder="Enter main description"
                        rows={6}
                      />
                    </div>

                    {/* Section information */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <label className="block text-sm font-medium">Section Information</label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>This section appears below the main content and above the features</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="space-y-4 p-4 border rounded-lg">
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
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="features">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">Features</h3>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>These features appear as cards at the bottom of the About page</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    
                    <Accordion type="single" collapsible className="w-full">
                      {content.features.map((feature, index) => (
                        <AccordionItem key={feature.id} value={feature.id}>
                          <AccordionTrigger className="text-lg font-medium">
                            {feature.title || `Feature ${index + 1}: ${feature.id}`}
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-4 p-4 border rounded-lg">
                              <div>
                                <label className="block text-sm font-medium mb-1">Feature Title</label>
                                <Input
                                  value={feature.title}
                                  onChange={(e) => {
                                    const newFeatures = [...content.features];
                                    newFeatures[index] = { ...feature, title: e.target.value };
                                    setContent({ ...content, features: newFeatures });
                                  }}
                                  placeholder="Feature title"
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
                                  placeholder="Feature description"
                                  rows={3}
                                />
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium mb-1">Feature Image</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <div className="border rounded-md p-2 bg-muted/20">
                                      <p className="text-xs text-muted-foreground mb-2">Current image:</p>
                                      {feature.image ? (
                                        <div className="relative aspect-video w-full bg-muted overflow-hidden rounded-md">
                                          <img 
                                            src={feature.image} 
                                            alt={`Feature: ${feature.title}`} 
                                            className="object-cover w-full h-full" 
                                          />
                                        </div>
                                      ) : (
                                        <div className="flex items-center justify-center aspect-video w-full bg-muted rounded-md">
                                          <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                                        </div>
                                      )}
                                    </div>
                                    <Input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => handleFeatureImageChange(feature.id, e)}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium mb-1">Image URL</label>
                                    <Input
                                      value={feature.image}
                                      onChange={(e) => {
                                        const newFeatures = [...content.features];
                                        newFeatures[index] = { ...feature, image: e.target.value };
                                        setContent({ ...content, features: newFeatures });
                                      }}
                                      placeholder="Feature image URL"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                      You can either upload a new image or provide a URL directly
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preview">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-6">
                    <h3 className="text-xl font-semibold text-center">Preview of About Page Content</h3>
                    
                    <div className="p-4 border rounded-lg">
                      <h2 className="text-2xl font-bold text-center mb-4">{content.title}</h2>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="aspect-video w-full overflow-hidden rounded-lg">
                          {content.mainImage ? (
                            <img 
                              src={content.mainImage} 
                              alt="Main about page image" 
                              className="object-cover w-full h-full" 
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full bg-muted rounded-md">
                              <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-base text-gray-600">{content.mainDescription}</p>
                        </div>
                      </div>
                      
                      <div className="mb-6">
                        <h3 className="text-xl font-semibold text-center mb-2">{content.sections[0]?.title}</h3>
                        <p className="text-center">{content.sections[0]?.description}</p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {content.features.map((feature) => (
                          <div key={feature.id} className="border rounded-lg overflow-hidden">
                            <div className="aspect-video w-full overflow-hidden bg-muted">
                              {feature.image ? (
                                <img 
                                  src={feature.image} 
                                  alt={feature.title} 
                                  className="object-cover w-full h-full" 
                                />
                              ) : (
                                <div className="flex items-center justify-center h-full">
                                  <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                                </div>
                              )}
                            </div>
                            <div className="p-3">
                              <h4 className="font-medium">{feature.title}</h4>
                              <p className="text-sm text-gray-600 mt-1">{feature.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateMutation.isPending || uploadMutation.isPending}
            >
              {updateMutation.isPending || uploadMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}