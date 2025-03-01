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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function AdminMenuPage() {
  const [isEditing, setIsEditing] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingSauce, setEditingSauce] = useState<Sauce | null>(null);
  const [isAddingSauce, setIsAddingSauce] = useState(false); // New state for adding sauces
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleEditItem = async (formData: FormData) => {
    try {
      if (!editingItem) return;

      // Handle image upload first if there's a new image
      const imageFile = formData.get('imageFile') as File;
      let imageUrl = editingItem.imageUrl;

      if (imageFile && imageFile.size > 0) {
        const imageFormData = new FormData();
        imageFormData.append('imageFile', imageFile);
        const uploadResponse = await fetch('/api/menu/items/upload', {
          method: 'POST',
          body: imageFormData,
          credentials: 'include'
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload image');
        }
        const uploadResult = await uploadResponse.json();
        imageUrl = uploadResult.imageUrl;
      }

      // Prepare update data
      const updateData = {
        name: formData.get('name') as string,
        description: formData.get('description') as string,
        imageUrl
      };

      // Validate required fields
      if (!updateData.name || !updateData.description) {
        throw new Error('Name and description are required');
      }

      // Send update request using apiRequest
      const result = await apiRequest(`/api/menu/items/${editingItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      // apiRequest already returns parsed JSON
      await queryClient.invalidateQueries({ queryKey: queryKeys.menu.items });
      toast({ title: "Menu item updated successfully" });
      setEditingItem(null);
    } catch (error) {
      console.error('Edit error:', error);
      toast({ 
        title: "Failed to update menu item", 
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive" 
      });
    }
  };

  const handleEditItemSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await handleEditItem(formData);
  };

  const handleEditItemClick = (item: MenuItem) => {
    setEditingItem(item);
  };

  const handleDeleteItem = async (id: number) => {
    try {
      await apiRequest(`/api/menu/items/${id}`, { method: 'DELETE' });
      window.location.reload();
    } catch (error) {
      console.error('Delete error:', error);
      window.location.reload();
    }
  };

  const handleEditSauce = async (formData: FormData) => {
    try {
      if (!editingSauce) return;

      await apiRequest(`/api/menu/sauces/${editingSauce.id}`, {
        method: 'PUT',
        body: formData
      });

      await queryClient.invalidateQueries({ queryKey: queryKeys.menu.sauces });
      toast({ title: "Sauce updated successfully" });
      setEditingSauce(null);
    } catch (error) {
      console.error('Edit error:', error);
      toast({ title: "Failed to update sauce", variant: "destructive" });
    }
  };

  const handleEditSauceClick = (sauce: Sauce) => {
    setEditingSauce(sauce);
  };

  const handleDeleteSauce = async (id: number) => {
    try {
      await apiRequest(`/api/menu/sauces/${id}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: queryKeys.menu.sauces });
      toast({ title: "Sauce deleted successfully" });
    } catch (error) {
      console.error('Delete error:', error);
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

  const createMenuItemMutation = useMutation({ // Mutation for creating menu items
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/menu/items", {
        method: "POST",
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create menu item: ${errorText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.menu.items });
      setIsEditing(false);
      toast({
        title: "Success",
        description: "Menu item created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createSauceMutation = useMutation({ // Mutation for creating sauces
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/menu/sauces", {
        method: "POST",
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create sauce: ${errorText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.menu.sauces });
      setIsAddingSauce(false);
      toast({
        title: "Success",
        description: "Sauce created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleMenuItemSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    createMenuItemMutation.mutate(new FormData(e.currentTarget));
  };

  const handleSauceSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    createSauceMutation.mutate(new FormData(e.currentTarget));
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
        <Tabs defaultValue="menu" className="space-y-4">
          <TabsList>
            <TabsTrigger value="menu">Menu Items</TabsTrigger>
            <TabsTrigger value="sauces">Sauces</TabsTrigger>
          </TabsList>

          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Menu Management</h1>
            {/* Show the appropriate Add button based on the current tab */}
            <div className="flex gap-2">
              <Button 
                onClick={() => {
                  setIsEditing(true);
                  setIsAddingSauce(false);
                }}
                className="menu-tab-button"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Menu Item
              </Button>
              <Button 
                onClick={() => {
                  setIsAddingSauce(true);
                  setIsEditing(false);
                }}
                className="sauce-tab-button"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Sauce
              </Button>
            </div>
          </div>

          {/* Sheet for adding menu items */}
          <Sheet open={isEditing} onOpenChange={setIsEditing}>
            <SheetContent className="sm:max-w-[425px]">
              <SheetHeader>
                <SheetTitle>Add New Menu Item</SheetTitle>
              </SheetHeader>
              <form
                onSubmit={handleMenuItemSubmit}
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
                  disabled={createMenuItemMutation.isPending}
                  onClick={() => console.log('Submit button clicked')}
                >
                  {createMenuItemMutation.isPending ? 'Creating...' : 'Create Menu Item'}
                </Button>
              </form>
            </SheetContent>
          </Sheet>

          {/* Sheet for adding sauces */}
          <Sheet open={isAddingSauce} onOpenChange={setIsAddingSauce}>
            <SheetContent className="sm:max-w-[425px]">
              <SheetHeader>
                <SheetTitle>Add New Sauce</SheetTitle>
              </SheetHeader>
              <form
                onSubmit={handleSauceSubmit}
                className="space-y-4 mt-4"
                encType="multipart/form-data"
                method="POST"
              >
                <div className="space-y-2">
                  <label htmlFor="sauce-name" className="text-sm font-medium">Name</label>
                  <Input
                    id="sauce-name"
                    name="name"
                    placeholder="Enter sauce name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="sauce-description" className="text-sm font-medium">Description</label>
                  <Textarea
                    id="sauce-description"
                    name="description"
                    placeholder="Enter sauce description"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="sauce-imageFile" className="text-sm font-medium">Image</label>
                  <Input
                    id="sauce-imageFile"
                    name="imageFile"
                    type="file"
                    accept="image/*"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createSauceMutation.isPending}
                >
                  {createSauceMutation.isPending ? 'Creating...' : 'Create Sauce'}
                </Button>
              </form>
            </SheetContent>
          </Sheet>

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
                      <Button variant="outline" onClick={() => handleEditItemClick(item)}>
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
                      <Button variant="outline" onClick={() => handleEditSauceClick(sauce)}>
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
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Menu Item</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditItemSubmit}>
            <div className="space-y-4">
              <Input
                name="name"
                defaultValue={editingItem?.name}
                placeholder="Item name"
              />
              <Textarea
                name="description"
                defaultValue={editingItem?.description}
                placeholder="Description"
              />
              <Input
                type="file"
                name="imageFile"
                accept="image/*"
              />
              <Input
                type="hidden"
                name="imageUrl"
                defaultValue={editingItem?.imageUrl}
              />
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingSauce} onOpenChange={() => setEditingSauce(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sauce</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            handleEditSauce(new FormData(e.currentTarget));
          }}>
            <div className="space-y-4">
              <Input
                name="name"
                defaultValue={editingSauce?.name}
                placeholder="Sauce name"
              />
              <Textarea
                name="description"
                defaultValue={editingSauce?.description}
                placeholder="Description"
              />
              <Input
                type="file"
                name="imageFile"
                accept="image/*"
              />
              <Input
                type="hidden"
                name="imageUrl"
                defaultValue={editingSauce?.imageUrl}
              />
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}