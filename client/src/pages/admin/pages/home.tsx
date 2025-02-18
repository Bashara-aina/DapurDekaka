
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Upload, Trash2 } from "lucide-react";
import AdminNavbar from "@/components/layout/admin-navbar";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function HomePageEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<{ [key: string]: File[] }>({
    logo: [],
    carouselImages: []
  });
  const [content, setContent] = useState({
    hero: {
      title: "",
      subtitle: "",
      description: ""
    }
  });

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['homepage'],
    queryFn: async () => {
      const response = await fetch('/api/pages/homepage');
      if (!response.ok) throw new Error('Failed to fetch homepage data');
      return response.json();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      files.logo?.[0] && formData.append('logo', files.logo[0]);
      files.carouselImages?.forEach(file => {
        formData.append('carouselImages', file);
      });
      formData.append('content', JSON.stringify(content));

      const response = await fetch('/api/pages/homepage', {
        method: 'PUT',
        body: formData
      });

      if (!response.ok) throw new Error('Failed to update homepage');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homepage'] });
      toast({
        title: "Success",
        description: "Homepage updated successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update homepage",
        variant: "destructive"
      });
    }
  });

  const deleteCarouselImage = useMutation({
    mutationFn: async (index: number) => {
      const response = await fetch(`/api/pages/homepage/carousel/${index}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete image');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homepage'] });
      toast({
        title: "Success",
        description: "Image deleted successfully"
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
        <h1 className="text-3xl font-bold mb-6">Edit Homepage</h1>
        <ScrollArea className="h-[800px] w-full rounded-md border p-4">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Logo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <img src={pageData?.logo} alt="Current Logo" className="w-32 h-32 object-contain" />
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFiles(prev => ({ ...prev, logo: Array.from(e.target.files || []) }))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Hero Section</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <div>
                    <label className="text-sm font-medium">Title</label>
                    <Input
                      value={content.hero.title}
                      onChange={(e) => setContent(prev => ({
                        ...prev,
                        hero: { ...prev.hero, title: e.target.value }
                      }))}
                      placeholder={pageData?.content.hero.title}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Subtitle</label>
                    <Input
                      value={content.hero.subtitle}
                      onChange={(e) => setContent(prev => ({
                        ...prev,
                        hero: { ...prev.hero, subtitle: e.target.value }
                      }))}
                      placeholder={pageData?.content.hero.subtitle}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      value={content.hero.description}
                      onChange={(e) => setContent(prev => ({
                        ...prev,
                        hero: { ...prev.hero, description: e.target.value }
                      }))}
                      placeholder={pageData?.content.hero.description}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Carousel Images</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => setFiles(prev => ({ ...prev, carouselImages: Array.from(e.target.files || []) }))}
                  />
                  <div className="grid grid-cols-4 gap-4">
                    {pageData?.carousel?.images.map((img: string, i: number) => (
                      <div key={i} className="relative group">
                        <img src={img} alt={`Carousel ${i}`} className="w-full aspect-square object-cover rounded" />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => deleteCarouselImage.mutate(i)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button 
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="w-full"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
