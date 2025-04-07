import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Trash2, GripVertical } from "lucide-react";
import AdminNavbar from "@/components/layout/admin-navbar";
import { ScrollArea } from "@/components/ui/scroll-area";
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
      <img 
        src={url} 
        alt={`Customer logo`} 
        className="w-24 h-24 object-contain rounded"
      />
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

  // Initialize content from pageData
  useEffect(() => {
    if (pageData?.content?.customers) {
      setContent({
        title: pageData.content.customers.title || "Our Customers",
        subtitle: pageData.content.customers.subtitle || "Trusted by businesses across Indonesia"
      });
    }
  }, [pageData]);

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

      const response = await fetch('/api/pages/homepage/customers', {
        method: 'PUT',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update customers section');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate both homepage queries for the main page and admin
      queryClient.invalidateQueries({ queryKey: ["pages", "homepage"] });
      queryClient.invalidateQueries({ queryKey: ["homepage"] });
      
      toast({
        title: "Success",
        description: "Customers section updated successfully",
      });
      
      // Reset the files state
      setFiles([]);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update customers section",
        variant: "destructive"
      });
    }
  });

  const reorderLogosMutation = useMutation({
    mutationFn: async (logos: string[]) => {
      const response = await fetch('/api/pages/homepage/customers/logos/reorder', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logos }),
      });
      if (!response.ok) throw new Error('Failed to reorder logos');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homepage"] });
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
      const response = await fetch(`/api/pages/homepage/customers/logos/${index}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete logo');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homepage"] });
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const customerLogos = pageData?.content?.customers?.logos || [];

  return (
    <>
      <AdminNavbar />
      <div className="container mx-auto p-6">
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
      </div>
    </>
  );
}