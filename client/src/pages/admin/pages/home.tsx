
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Upload } from "lucide-react";
import AdminNavbar from "@/components/layout/admin-navbar";

export default function HomePageEditor() {
  const { toast } = useToast();
  const [files, setFiles] = useState<{ [key: string]: File[] }>({
    logo: [],
    carouselImages: []
  });
  const [content, setContent] = useState({
    hero: {
      title: "",
      subtitle: ""
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
                  {pageData?.carousel.images.map((img: string, i: number) => (
                    <img key={i} src={img} alt={`Carousel ${i}`} className="w-full aspect-square object-cover rounded" />
                  ))}
                </div>
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
      </div>
    </>
  );
}
