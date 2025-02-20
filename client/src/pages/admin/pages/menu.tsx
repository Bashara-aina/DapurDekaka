import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { MenuItem, Sauce } from "@shared/schema";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminNavbar from "@/components/layout/admin-navbar";
import { queryKeys } from "@/lib/queryClient";

type EditingItem = (MenuItem | Sauce) & { type: 'menu' | 'sauce' };

export default function AdminMenuPage() {
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: menuItems, isLoading: menuLoading } = useQuery({
    queryKey: queryKeys.menu.items,
    queryFn: async () => {
      const response = await fetch("/api/menu/items", {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        cache: 'no-store'
      });
      if (!response.ok) throw new Error("Failed to fetch menu items");
      return response.json();
    }
  });

  const { data: sauces, isLoading: saucesLoading } = useQuery({
    queryKey: queryKeys.menu.sauces,
    queryFn: async () => {
      const response = await fetch("/api/menu/sauces", {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        cache: 'no-store'
      });
      if (!response.ok) throw new Error("Failed to fetch sauces");
      return response.json();
    }
  });

  const createMutation = useMutation({
    mutationFn: async ({ type, formData }: { type: 'menu' | 'sauce', formData: FormData }) => {
      const response = await fetch(`/api/menu/${type === 'menu' ? 'items' : 'sauces'}`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error(`Failed to create ${type}`);
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: variables.type === 'menu' ? queryKeys.menu.items : queryKeys.menu.sauces 
      });
      toast({ title: "Success", description: `${variables.type === 'menu' ? 'Menu item' : 'Sauce'} created successfully` });
      setIsEditing(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ type, id, formData }: { type: 'menu' | 'sauce', id: number, formData: FormData }) => {
      const response = await fetch(`/api/menu/${type === 'menu' ? 'items' : 'sauces'}/${id}`, {
        method: "PUT",
        body: formData,
      });
      if (!response.ok) throw new Error(`Failed to update ${type}`);
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: variables.type === 'menu' ? queryKeys.menu.items : queryKeys.menu.sauces 
      });
      toast({ title: "Success", description: `${variables.type === 'menu' ? 'Menu item' : 'Sauce'} updated successfully` });
      setIsEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: 'menu' | 'sauce', id: number }) => {
      const response = await fetch(`/api/menu/${type === 'menu' ? 'items' : 'sauces'}/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(`Failed to delete ${type}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: variables.type === 'menu' ? queryKeys.menu.items : queryKeys.menu.sauces 
      });
      toast({ title: "Success", description: `${variables.type === 'menu' ? 'Menu item' : 'Sauce'} deleted successfully` });
    },
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      if (editingItem) {
        await updateMutation.mutateAsync({ 
          type: editingItem.type, 
          id: editingItem.id, 
          formData 
        });
      } else {
        const type = formData.get('type') as 'menu' | 'sauce';
        await createMutation.mutateAsync({ type, formData });
      }
      setEditingItem(null);
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
                      <p className="font-medium">Rp {item.price.toLocaleString()}</p>
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
                          variant="outline"
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
                          variant="outline"
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
              {(!editingItem || editingItem.type === 'menu') && (
                <div>
                  <Input
                    type="number"
                    name="price"
                    placeholder="Price"
                    defaultValue={editingItem?.type === 'menu' ? editingItem.price : ''}
                    required={!editingItem || editingItem.type === 'menu'}
                  />
                </div>
              )}
              <div>
                <Input
                  type="file"
                  name="image"
                  accept="image/*"
                />
              </div>
              <Button type="submit">
                {editingItem ? 'Update' : 'Create'}
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}