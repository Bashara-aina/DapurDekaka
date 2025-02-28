
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Trash2, GripVertical } from "lucide-react";
import AdminNavbar from "@/components/layout/admin-navbar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryKeys } from "@/lib/queryClient";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type SortableImageProps = {
  id: string;
  url: string;
  index: number;
  onDelete: () => void;
};

const SortableImage = ({ id, url, onDelete }: SortableImageProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group flex items-center gap-2 p-2 bg-white rounded-lg shadow-sm"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-5 w-5 text-gray-400" />
      </button>
      <img src={url} alt={`Carousel ${id}`} className="w-24 h-24 object-cover rounded" />
      <Button
        variant="destructive"
        size="icon"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default function HomePageEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<{ [key: string]: File[] }>({
    logo: [],
    carouselImages: []
  });
  const [content, setContent] = useState({
    carousel: {
      title: "",
      subtitle: ""
    }
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { data: pageData, isLoading } = useQuery({
    queryKey: ["homepage"],
    queryFn: async () => {
      const response = await fetch('/api/pages/homepage', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        cache: 'no-store'
      });
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
      formData.append('content', JSON.stringify({
        carousel: {
          title: content.carousel.title || pageData?.content?.carousel?.title,
          subtitle: content.carousel.subtitle || pageData?.content?.carousel?.subtitle
        }
      }));

      const response = await fetch('/api/pages/homepage', {
        method: 'PUT',
        body: formData
      });

      if (!response.ok) throw new Error('Failed to update homepage');
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["homepage"],
        refetchType: 'all'
      });
      await queryClient.refetchQueries({
        queryKey: ["homepage"],
        type: 'all'
      });
      toast({
        title: "Success",
        description: "Homepage updated successfully"
      });
      setFiles({ logo: [], carouselImages: [] });
      setContent({
        carousel: { title: "", subtitle: "" }
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update homepage",
        variant: "destructive"
      });
    }
  });

  const reorderImagesMutation = useMutation({
    mutationFn: async (images: string[]) => {
      const response = await fetch('/api/pages/homepage/carousel/reorder', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ images }),
      });
      if (!response.ok) throw new Error('Failed to reorder images');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homepage"] });
      toast({
        title: "Success",
        description: "Image order updated successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update image order",
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
      queryClient.invalidateQueries({ queryKey: ["homepage"] });
      toast({
        title: "Success",
        description: "Image deleted successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete image",
        variant: "destructive"
      });
    }
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && pageData?.carousel?.images) {
      const oldIndex = pageData.carousel.images.findIndex((url: string) => url === active.id);
      const newIndex = pageData.carousel.images.findIndex((url: string) => url === over.id);

      const newImages = arrayMove(pageData.carousel.images as string[], oldIndex, newIndex);
      reorderImagesMutation.mutate(newImages);
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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Edit Homepage</h1>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
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
        <ScrollArea className="h-[800px] w-full rounded-md border p-4">
          <div className="grid gap-6">
            {/* Logo Section */}
            <Card>
              <CardHeader>
                <CardTitle>Logo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  {pageData?.logo && (
                    <img src={pageData.logo} alt="Current Logo" className="w-32 h-32 object-contain" />
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFiles(prev => ({ ...prev, logo: Array.from(e.target.files || []) }))}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Carousel Text Section */}
            <Card>
              <CardHeader>
                <CardTitle>Carousel Text</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <div>
                    <label className="text-sm font-medium">Title</label>
                    <Input
                      value={content.carousel.title}
                      onChange={(e) => setContent(prev => ({
                        ...prev,
                        carousel: { ...prev.carousel, title: e.target.value }
                      }))}
                      placeholder={pageData?.content?.carousel?.title || "Dapur Dekaka"}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Subtitle</label>
                    <Input
                      value={content.carousel.subtitle}
                      onChange={(e) => setContent(prev => ({
                        ...prev,
                        carousel: { ...prev.carousel, subtitle: e.target.value }
                      }))}
                      placeholder={pageData?.content?.carousel?.subtitle || "Nikmati Sensasi Dimsum Premium dengan Cita Rasa Autentik!"}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Carousel Images Section */}
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
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={pageData?.carousel?.images || []}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="grid gap-2">
                        {pageData?.carousel?.images?.map((img: string, i: number) => (
                          <SortableImage
                            key={img}
                            id={img}
                            url={img}
                            index={i}
                            onDelete={() => deleteCarouselImage.mutate(i)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
