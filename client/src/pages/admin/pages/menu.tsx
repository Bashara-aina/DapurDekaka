import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { MenuItem, Sauce } from "@shared/schema";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminNavbar from "@/components/layout/admin-navbar";
import { queryKeys, apiRequest } from "@/lib/queryClient";
import { Textarea } from "@/components/ui/textarea";

export default function AdminMenuPage() {
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleEditItem = (item: MenuItem) => {
    // TODO: Implement edit functionality
    console.log("Edit item:", item);
  };

  const handleDeleteItem = async (id: number) => {
    try {
      await apiRequest(`/api/menu/items/${id}`, { method: 'DELETE' });
      queryClient.invalidateQueries({ queryKey: queryKeys.menu.items });
      toast({ title: "Menu item deleted successfully" });
    } catch (error) {
      toast({ title: "Failed to delete menu item", variant: "destructive" });
    }
  };

  const handleEditSauce = (sauce: Sauce) => {
    // TODO: Implement edit functionality
    console.log("Edit sauce:", sauce);
  };

  const handleDeleteSauce = async (id: number) => {
    try {
      await apiRequest(`/api/menu/sauces/${id}`, { method: 'DELETE' });
      queryClient.invalidateQueries({ queryKey: queryKeys.menu.sauces });
      toast({ title: "Sauce deleted successfully" });
    } catch (error) {
      toast({ title: "Failed to delete sauce", variant: "destructive" });
    }
  };

  const { data: menuItems, isLoading: menuLoading } = useQuery({
    queryKey: queryKeys.menu.items,
    queryFn: () => apiRequest("/api/menu/items")
  });

  const { data: sauces, isLoading: saucesLoading } = useQuery({
    queryKey: queryKeys.menu.sauces,
    queryFn: () => apiRequest("/api/menu/sauces")
  });

  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      console.log('\n=== Frontend Request Debug ===');
      console.log('Content-Type:', 'multipart/form-data');

      // Log each field separately for clarity
      const fields = Array.from(formData.entries()).reduce((acc: Record<string, any>, [key, value]) => {
        if (value instanceof File) {
          acc[key] = {
            type: 'File',
            name: value.name,
            size: value.size,
            mimeType: value.type
          };
        } else {
          acc[key] = {
            type: 'Field',
            value: value
          };
        }
        return acc;
      }, {});

      console.log('Form Fields:', JSON.stringify(fields, null, 2));

      const response = await fetch("/api/menu/items", {
        method: "POST",
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Request Failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          contentType: response.headers.get('content-type')
        });
        throw new Error(`Failed to create menu item: ${errorText}`);
      }

      const result = await response.json();
      console.log('Request Succeeded:', result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu"] });
      setIsEditing(false);
      toast({
        title: "Success",
        description: "Menu item created successfully",
      });
    },
    onError: (error: Error) => {
      console.error('Mutation Error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    console.log('\n=== Form Submission Debug ===');
    const form = e.currentTarget;

    console.log('Form Properties:', {
      method: form.method,
      enctype: form.enctype,
      action: form.action,
      elements: Array.from(form.elements).map(el => ({
        name: (el as HTMLInputElement).name,
        type: (el as HTMLInputElement).type,
        id: (el as HTMLInputElement).id
      }))
    });

    const formData = new FormData(form);

    console.log('Form Fields:');
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(`Field: ${key} (File)`, {
          name: value.name,
          type: value.type,
          size: value.size
        });
      } else {
        console.log(`Field: ${key}`, value);
      }
    }

    createMutation.mutate(formData);
  };

  if (menuLoading || saucesLoading) {
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
          <h1 className="text-3xl font-bold">Menu Management</h1>
          <Button onClick={() => setIsEditing(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        </div>

        <Sheet open={isEditing} onOpenChange={setIsEditing}>
          <SheetContent className="sm:max-w-[425px]">
            <SheetHeader>
              <SheetTitle>Add New Menu Item</SheetTitle>
            </SheetHeader>
            <form
              onSubmit={handleSubmit}
              className="space-y-4 mt-4"
              encType="multipart/form-data"
              method="POST"
            >
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">Name</label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Enter item name"
                  required
                  onChange={(e) => console.log('Name input changed:', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium">Description</label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Enter item description"
                  required
                  onChange={(e) => console.log('Description input changed:', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="imageFile" className="text-sm font-medium">Image</label>
                <Input
                  id="imageFile"
                  name="imageFile"
                  type="file"
                  accept="image/*"
                  required
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      console.log('Image file selected:', {
                        name: file.name,
                        type: file.type,
                        size: file.size
                      });
                    }
                  }}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={createMutation.isPending}
                onClick={() => console.log('Submit button clicked')}
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </form>
          </SheetContent>
        </Sheet>

        <Tabs defaultValue="menu" className="space-y-4">
          <TabsList>
            <TabsTrigger value="menu">Menu Items</TabsTrigger>
            <TabsTrigger value="sauces">Sauces</TabsTrigger>
          </TabsList>

          <TabsContent value="menu">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {menuItems?.map((item: MenuItem) => (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-48 object-cover rounded-md mb-4"
                    />
                    <h3 className="font-semibold">{item.name}</h3>
                    <p className="text-sm text-gray-600">{item.description}</p>
                    <div className="flex gap-2 mt-4">
                      <Button variant="outline" onClick={() => handleEditItem(item)}>
                        Edit
                      </Button>
                      <Button variant="destructive" onClick={() => handleDeleteItem(item.id)}>
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="sauces">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sauces?.map((sauce: Sauce) => (
                <Card key={sauce.id}>
                  <CardContent className="p-4">
                    <img
                      src={sauce.imageUrl}
                      alt={sauce.name}
                      className="w-full h-48 object-cover rounded-md mb-4"
                    />
                    <h3 className="font-semibold">{sauce.name}</h3>
                    <p className="text-sm text-gray-600">{sauce.description}</p>
                    <div className="flex gap-2 mt-4">
                      <Button variant="outline" onClick={() => handleEditSauce(sauce)}>
                        Edit
                      </Button>
                      <Button variant="destructive" onClick={() => handleDeleteSauce(sauce.id)}>
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}