import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { MenuItem, Sauce, insertMenuItemSchema, insertSauceSchema } from "@shared/schema";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminNavbar from "@/components/layout/admin-navbar";
import { queryKeys, apiRequest } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

type EditingItem = {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
  type: 'menu' | 'sauce';
};

export default function AdminMenuPage() {
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: menuItems, isLoading: menuLoading } = useQuery({
    queryKey: queryKeys.menu.items,
    queryFn: () => apiRequest("/api/menu/items")
  });

  const { data: sauces, isLoading: saucesLoading } = useQuery({
    queryKey: queryKeys.menu.sauces,
    queryFn: () => apiRequest("/api/menu/sauces")
  });

  const createMutation = useMutation({
    mutationFn: async ({ type, data }: { type: 'menu' | 'sauce', data: FormData }) => {
      const response = await fetch(`/api/menu/${type === 'menu' ? 'items' : 'sauces'}`, {
        method: "POST",
        body: data,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to create ${type}`);
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: variables.type === 'menu' ? queryKeys.menu.items : queryKeys.menu.sauces 
      });
      toast({ 
        title: "Success", 
        description: `${variables.type === 'menu' ? 'Menu item' : 'Sauce'} created successfully` 
      });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ type, id, data }: { type: 'menu' | 'sauce', id: number, data: FormData }) => {
      const response = await fetch(`/api/menu/${type === 'menu' ? 'items' : 'sauces'}/${id}`, {
        method: "PUT",
        body: data,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to update ${type}`);
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: variables.type === 'menu' ? queryKeys.menu.items : queryKeys.menu.sauces 
      });
      toast({ 
        title: "Success", 
        description: `${variables.type === 'menu' ? 'Menu item' : 'Sauce'} updated successfully` 
      });
      setIsEditing(false);
      setEditingItem(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // Validate required fields
    const name = formData.get('name');
    const description = formData.get('description');
    const image = formData.get('image');
    const type = formData.get('type') as 'menu' | 'sauce';

    if (!name || !description ) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingItem) {
        const data = new FormData();
        data.append('name', name as string);
        data.append('description', description as string);
        if (image instanceof File && image.size > 0) {
          data.append('image', image);
        } else {
          data.append('imageUrl', editingItem.imageUrl);
        }

        await updateMutation.mutateAsync({ 
          type: editingItem.type, 
          id: editingItem.id, 
          data 
        });
      } else {
        if (!image || !(image instanceof File) || image.size === 0) {
          toast({
            title: "Error",
            description: "Please select an image",
            variant: "destructive"
          });
          return;
        }
        await createMutation.mutateAsync({ type, data: formData });
      }
    } catch (error) {
      console.error('Error:', error);
    }
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

        <Tabs defaultValue="menu" className="space-y-4">
          <TabsList>
            <TabsTrigger value="menu">Menu Items</TabsTrigger>
            <TabsTrigger value="sauces">Sauces</TabsTrigger>
          </TabsList>

          <TabsContent value="menu" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {menuItems?.map((item: MenuItem) => (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-48 object-cover rounded-md mb-4"
                    />
                    <div className="space-y-2">
                      <h3 className="font-semibold">{item.name}</h3>
                      <p className="text-sm text-gray-600">{item.description}</p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingItem({ ...item, type: 'menu' });
                            setIsEditing(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this item?')) {
                              deleteMutation.mutate({ type: 'menu', id: item.id });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="sauces" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sauces?.map((sauce: Sauce) => (
                <Card key={sauce.id}>
                  <CardContent className="p-4">
                    <img
                      src={sauce.imageUrl}
                      alt={sauce.name}
                      className="w-full h-48 object-cover rounded-md mb-4"
                    />
                    <div className="space-y-2">
                      <h3 className="font-semibold">{sauce.name}</h3>
                      <p className="text-sm text-gray-600">{sauce.description}</p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingItem({ ...sauce, type: 'sauce' });
                            setIsEditing(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this sauce?')) {
                              deleteMutation.mutate({ type: 'sauce', id: sauce.id });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <Sheet open={isEditing} onOpenChange={setIsEditing}>
          <SheetContent className="w-[400px] sm:w-[540px]">
            <SheetHeader>
              <SheetTitle>
                {editingItem ? 
                  `Edit ${editingItem.type === 'menu' ? 'Menu Item' : 'Sauce'}` : 
                  'Add New Item'
                }
              </SheetTitle>
            </SheetHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              {!editingItem && (
                <div>
                  <select 
                    name="type" 
                    className="w-full p-2 border rounded-md"
                    defaultValue="menu"
                  >
                    <option value="menu">Menu Item</option>
                    <option value="sauce">Sauce</option>
                  </select>
                </div>
              )}
              <div>
                <Input
                  name="name"
                  placeholder="Name"
                  defaultValue={editingItem?.name}
                  required
                />
              </div>
              <div>
                <Input
                  name="description"
                  placeholder="Description"
                  defaultValue={editingItem?.description}
                  required
                />
              </div>
              <div>
                <Input
                  type="file"
                  name="image"
                  accept="image/*"
                  className="cursor-pointer"
                />
                {editingItem && (
                  <p className="text-sm text-gray-500 mt-1">
                    Leave empty to keep the current image
                  </p>
                )}
              </div>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || updateMutation.isPending}
                className="w-full"
              >
                {(createMutation.isPending || updateMutation.isPending) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {editingItem ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  editingItem ? 'Update' : 'Create'
                )}
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}