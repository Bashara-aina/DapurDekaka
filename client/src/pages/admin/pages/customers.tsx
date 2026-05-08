import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Trash2, GripVertical, AlertTriangle } from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useAuth } from "@/hooks/useAuth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryKeys } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { AdminPageSkeleton } from "@/components/admin/AdminPageSkeleton";
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

type SortableLogoProps = {
  id: string;
  url: string;
  index: number;
  onDelete: () => void;
};

const SortableLogo = ({ id, url, onDelete }: SortableLogoProps) => {
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

  const [hasError, setHasError] = useState(false);

  const handleImageError = () => {
    console.error(`Failed to load logo: ${url}`);
    setHasError(true);
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
      {hasError ? (
        <div className="w-24 h-24 flex items-center justify-center bg-gray-100 rounded text-amber-600">
          <AlertTriangle className="h-8 w-8" />
          <span className="text-xs ml-1">Image Error</span>
        </div>
      ) : (
        <img 
          src={url} 
          alt={`Customer logo`} 
          className="w-24 h-24 object-contain rounded"
          onError={handleImageError}
        />
      )}
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

export default function CustomersPageEditor() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [activeTab, setActiveTab] = useState("general");
  const [content, setContent] = useState({
    title: "",
    subtitle: ""
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  interface HomepageData {
  logo: string;
  carousel: {
    images: string[];
    title: string;
    subtitle: string;
  };
  content: {
    hero: { title: string; subtitle: string };
    carousel: { title: string; subtitle: string };
    featuredProducts: { title: string; subtitle: string };
    latestArticles: { title: string; subtitle: string };
    customers: { title: string; subtitle: string; logos: string[] };
  };
  timestamp?: number;
}

const { data: pageData, isLoading, isError } = useQuery<HomepageData>({
    queryKey: queryKeys.pages.homepage,
    queryFn: () => apiRequest<HomepageData>("/api/pages/homepage"),
    enabled: !!isAuthenticated,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('customerLogos', file);
      });

      // Add customer section content
      formData.append('content', JSON.stringify({
        customers: {
          title: content.title,
          subtitle: content.subtitle,
          logos: pageData?.content?.customers?.logos || []
        }
      }));

      return await apiRequest('/api/pages/homepage/customers', {
        method: 'PUT',
        body: formData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pages.homepage });
      toast({
        title: "Success",
        description: "Customers section updated successfully",
      });
      setFiles([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update customers section",
        variant: "destructive"
      });
    }
  });

  const reorderLogosMutation = useMutation({
    mutationFn: async (logos: string[]) => {
      return await apiRequest('/api/pages/homepage/customers/logos/reorder', {
        method: 'PUT',
        body: JSON.stringify({ logos }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pages.homepage });
      toast({
        title: "Success",
        description: "Logo order updated successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update logo order",
        variant: "destructive"
      });
    }
  });

  const deleteLogoMutation = useMutation({
    mutationFn: async (index: number) => {
      return await apiRequest(`/api/pages/homepage/customers/logos/${index}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pages.homepage });
      toast({
        title: "Success",
        description: "Logo deleted successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete logo",
        variant: "destructive"
      });
    }
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && pageData?.content?.customers?.logos) {
      const oldIndex = pageData.content.customers.logos.findIndex((url: string) => url === active.id);
      const newIndex = pageData.content.customers.logos.findIndex((url: string) => url === over.id);

      const newLogos = arrayMove(pageData.content.customers.logos as string[], oldIndex, newIndex);
      reorderLogosMutation.mutate(newLogos);
    }
  };

  if (authLoading || isLoading) {
    return (
      <AdminLayout>
        <AdminPageSkeleton title="Customers Section" showTabs />
      </AdminLayout>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (isError) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground mb-4">Failed to load customers data. Please try again.</p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.pages.homepage })}>
            Retry
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const customerLogos = pageData?.content?.customers?.logos || [];

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Customers Section</h1>
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

        <Tabs defaultValue="general" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="logos">Customer Logos</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>General Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <div>
                    <label className="text-sm font-medium">Section Title</label>
                    <Input
                      value={content.title}
                      onChange={(e) => setContent(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Our Customers"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Section Subtitle</label>
                    <Input
                      value={content.subtitle}
                      onChange={(e) => setContent(prev => ({ ...prev, subtitle: e.target.value }))}
                      placeholder="Trusted by businesses across Indonesia"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logos">
            <Card>
              <CardHeader>
                <CardTitle>Customer Logos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <div className="bg-muted/50 rounded p-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      Upload company logos to be displayed in the scrolling customer logo section. For best results, use square or landscape-oriented images with transparent backgrounds.
                    </p>
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => setFiles(Array.from(e.target.files || []))}
                    />
                  </div>
                  
                  {customerLogos.length === 0 ? (
                    <div className="text-center py-8 border-dashed border-2 rounded-md">
                      <p className="text-muted-foreground">No customer logos yet. Upload some logos to get started.</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px] w-full pr-4">
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Drag and drop to reorder logos. Click the trash icon to delete.
                      </p>
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={customerLogos}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="grid gap-2">
                            {customerLogos.map((logo: string, i: number) => (
                              <SortableLogo
                                key={logo}
                                id={logo}
                                url={logo}
                                index={i}
                                onDelete={() => deleteLogoMutation.mutate(i)}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </ScrollArea>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview">
            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg p-6 bg-gray-50">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold">{content.title || pageData?.content?.customers?.title || "Our Customers"}</h2>
                    <p className="text-gray-600 mt-1">{content.subtitle || pageData?.content?.customers?.subtitle || "Trusted by businesses across Indonesia"}</p>
                  </div>

                  {customerLogos.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No logos to display. Add logos in the "Customer Logos" tab.</p>
                    </div>
                  ) : (
                    <div className="relative overflow-hidden py-4">
                      <div className="flex flex-wrap justify-center gap-6">
                        {customerLogos.map((logo: string, index: number) => (
                          <div key={index} className="bg-white p-4 rounded shadow-sm flex items-center justify-center h-24 w-36">
                            <img 
                              src={logo} 
                              alt={`Customer logo ${index + 1}`}
                              className="h-16 max-w-full object-contain"
                              onError={(e) => {
                                console.error(`Failed to load preview logo: ${logo}`);
                                e.currentTarget.src = '/logo/logo.png'; // Fallback to default logo
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="text-center mt-6 text-sm text-muted-foreground">
                        <p>On the homepage, logos will appear in a continuous scrolling animation.</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
    </AdminLayout>
  );
}