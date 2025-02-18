
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Upload } from "lucide-react";
import AdminNavbar from "@/components/layout/admin-navbar";

export default function AdminHomePage() {
  const [content, setContent] = useState<any>(null);
  const [files, setFiles] = useState<{ logo?: File[], carouselImages?: File[] }>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: homepage, isLoading } = useQuery({
    queryKey: ["/api/pages/homepage"],
    queryFn: async () => {
      const response = await fetch("/api/pages/homepage");
      if (!response.ok) throw new Error("Failed to fetch homepage data");
      const data = await response.json();
      setContent(data.content);
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      if (files.logo) {
        formData.append("logo", files.logo[0]);
      }
      if (files.carouselImages) {
        files.carouselImages.forEach(file => {
          formData.append("carouselImages", file);
        });
      }
      formData.append("content", JSON.stringify(content));

      const response = await fetch("/api/pages/homepage", {
        method: "PUT",
        body: formData,
        credentials: 'include'
      });
      if (!response.ok) throw new Error("Failed to update homepage");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages/homepage"] });
      toast({ title: "Success", description: "Homepage updated successfully" });
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
            <CardTitle>Homepage Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-2">Logo</h3>
                <Input
                  type="file"
                  onChange={(e) => setFiles(prev => ({ ...prev, logo: e.target.files ? [e.target.files[0]] : undefined }))}
                  accept="image/*"
                />
                {homepage?.logo && (
                  <img src={homepage.logo} alt="Current logo" className="mt-2 h-20" />
                )}
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">Carousel Images</h3>
                <Input
                  type="file"
                  multiple
                  onChange={(e) => setFiles(prev => ({ ...prev, carouselImages: e.target.files ? Array.from(e.target.files) : undefined }))}
                  accept="image/*"
                />
                <ScrollArea className="h-40 mt-2">
                  <div className="flex gap-2 flex-wrap">
                    {homepage?.carousel.images.map((img: string, i: number) => (
                      <img key={i} src={img} alt={`Carousel ${i + 1}`} className="h-20" />
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">Hero Content</h3>
                <div className="space-y-2">
                  <Input
                    placeholder="Title"
                    value={content?.hero?.title || ""}
                    onChange={(e) => setContent(prev => ({
                      ...prev,
                      hero: { ...prev?.hero, title: e.target.value }
                    }))}
                  />
                  <Input
                    placeholder="Subtitle"
                    value={content?.hero?.subtitle || ""}
                    onChange={(e) => setContent(prev => ({
                      ...prev,
                      hero: { ...prev?.hero, subtitle: e.target.value }
                    }))}
                  />
                </div>
              </div>

              <Button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
