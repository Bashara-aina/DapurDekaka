import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { MenuItem, Sauce } from "@shared/schema";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, Plus, MoveVertical, Edit, Trash } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminLayout from "@/components/layout/AdminLayout";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys, apiRequest } from "@/lib/queryClient";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminPageSkeleton } from "@/components/admin/AdminPageSkeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import { 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable';
import { SortableItem, DragHandle } from "@/components/ui/SortableItem";

type FormFieldValue = string | File;

export default function AdminMenuPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingSauce, setEditingSauce] = useState<Sauce | null>(null);
  const [localMenuItems, setLocalMenuItems] = useState<MenuItem[]>([]);
  const [localSauces, setLocalSauces] = useState<Sauce[]>([]);
  const [deleteItemId, setDeleteItemId] = useState<number | null>(null);
  const [deleteSauceId, setDeleteSauceId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const handleEditItem = async (formData: FormData) => {
    try {
      if (!editingItem) return;

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

      const updateData = {
        name: formData.get('name') as string,
        description: formData.get('description') as string,
        price: formData.get('price') as string,
        imageUrl
      };

      if (!updateData.name || !updateData.description) {
        throw new Error('Name and description are required');
      }

      await apiRequest(`/api/menu/items/${editingItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      await queryClient.invalidateQueries({ queryKey: queryKeys.menu.items });
      toast({ title: "Menu item updated successfully" });
      setEditingItem(null);
    } catch (error) {
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

  const confirmDeleteItem = (id: number) => {
    setDeleteItemId(id);
  };

  const handleDeleteItem = async (id: number) => {
    try {
      await apiRequest(`/api/menu/items/${id}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: queryKeys.menu.items });
      toast({ 
        title: "Success", 
        description: "Menu item deleted successfully" 
      });
      setDeleteItemId(null);
    } catch {
      toast({ 
        title: "Error", 
        description: "Failed to delete menu item",
        variant: "destructive"
      });
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
    } catch {
      toast({ title: "Failed to update sauce", variant: "destructive" });
    }
  };

  const handleEditSauceClick = (sauce: Sauce) => {
    setEditingSauce(sauce);
  };

  const confirmDeleteSauce = (id: number) => {
    setDeleteSauceId(id);
  };
  
  const handleDeleteSauce = async (id: number) => {
    try {
      await apiRequest(`/api/menu/sauces/${id}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: queryKeys.menu.sauces });
      toast({ 
        title: "Success", 
        description: "Sauce deleted successfully" 
      });
      setDeleteSauceId(null);
    } catch {
      toast({ 
        title: "Error", 
        description: "Failed to delete sauce",
        variant: "destructive"
      });
    }
  };

  const { data: menuItems, isLoading: menuLoading, isError: menuError } = useQuery<MenuItem[]>({
    queryKey: queryKeys.menu.items,
    queryFn: () => apiRequest<MenuItem[]>("/api/menu/items"),
    enabled: !!isAuthenticated,
  });

  const { data: sauces, isLoading: saucesLoading, isError: saucesError } = useQuery<Sauce[]>({
    queryKey: queryKeys.menu.sauces,
    queryFn: () => apiRequest<Sauce[]>("/api/menu/sauces"),
    enabled: !!isAuthenticated,
  });
  
  useEffect(() => {
    if (menuItems) {
      setLocalMenuItems(menuItems);
    }
  }, [menuItems]);
  
  useEffect(() => {
    if (sauces) {
      setLocalSauces(sauces);
    }
  }, [sauces]);
  
  const handleMenuItemDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = localMenuItems.findIndex(item => item.id === active.id);
      const newIndex = localMenuItems.findIndex(item => item.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newItems = arrayMove(localMenuItems, oldIndex, newIndex);
        setLocalMenuItems(newItems);
        
        try {
          const itemIds = newItems.map(item => item.id);
          await apiRequest('/api/menu/items/reorder', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ itemIds })
          });
          
          toast({ 
            title: "Menu items reordered successfully",
            variant: "default"
          });
          
          queryClient.invalidateQueries({ queryKey: queryKeys.menu.items });
        } catch (error) {
          toast({ 
            title: "Failed to reorder menu items", 
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive" 
          });
          
          setLocalMenuItems(menuItems || []);
        }
      }
    }
  };
  
  const handleSauceDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = localSauces.findIndex(sauce => sauce.id === active.id);
      const newIndex = localSauces.findIndex(sauce => sauce.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newSauces = arrayMove(localSauces, oldIndex, newIndex);
        setLocalSauces(newSauces);
        
        try {
          const sauceIds = newSauces.map(sauce => sauce.id);
          await apiRequest('/api/menu/sauces/reorder', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sauceIds })
          });
          
          toast({ 
            title: "Sauces reordered successfully",
            variant: "default"
          });
          
          queryClient.invalidateQueries({ queryKey: queryKeys.menu.sauces });
        } catch (error) {
          toast({ 
            title: "Failed to reorder sauces", 
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive" 
          });
          
          setLocalSauces(sauces || []);
        }
      }
    }
  };

  const createMutation = useMutation({
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
      queryClient.invalidateQueries({ queryKey: ["/api/menu"] });
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createMutation.mutate(formData);
  };

  const handleAddItemSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const formData = new FormData(e.currentTarget);
      await apiRequest('/api/menu/items', {
        method: 'POST',
        body: formData
      });

      e.currentTarget.reset();
      await queryClient.invalidateQueries({ queryKey: queryKeys.menu.items });
      toast({ title: "Menu item added successfully" });
    } catch {
      toast({ title: "Failed to add menu item", variant: "destructive" });
    }
  };

  const handleAddSauceSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const form = e.currentTarget;
      const formData = new FormData(form);

      const response = await fetch("/api/menu/sauces", {
        method: "POST",
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create sauce');
      }

      form.reset();
      await queryClient.invalidateQueries({ queryKey: queryKeys.menu.sauces });
      toast({ title: "Sauce added successfully" });
    } catch (error) {
      toast({ 
        title: "Failed to add sauce", 
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive" 
      });
    }
  };

  if (authLoading || menuLoading || saucesLoading) {
    return (
      <AdminLayout>
        <AdminPageSkeleton title="Menu Management" showCards scrollAreaHeight="h-[600px]" />
      </AdminLayout>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (menuError || saucesError) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground mb-4">Failed to load menu data. Please try again.</p>
          <Button onClick={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.menu.items });
            queryClient.invalidateQueries({ queryKey: queryKeys.menu.sauces });
          }}>
            Retry
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
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
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium">Description</label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Enter item description"
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="price" className="text-sm font-medium">Price</label>
                <Input
                  id="price"
                  name="price"
                  placeholder="Enter price (e.g., Rp 25.000)"
                  required
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
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={createMutation.isPending}
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
            <div className="mb-4">
              <h3 className="text-lg font-semibold flex items-center">
                <MoveVertical className="w-5 h-5 mr-2" />
                Drag to reorder menu items
              </h3>
              <p className="text-sm text-gray-600">Items will appear in this order on the public menu</p>
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleMenuItemDragEnd}
            >
              <SortableContext
                items={localMenuItems.map(item => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {localMenuItems.map((item: MenuItem) => (
                    <SortableItem key={item.id} id={item.id}>
                      <Card className="border-2 border-dashed border-gray-200 hover:border-primary transition-colors">
                        <CardContent className="p-4">
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-48 object-cover rounded-md mb-4"
                          />
                          <h3 className="font-semibold">{item.name}</h3>
                          <p className="text-sm text-gray-600">{item.description}</p>
                          <p className="text-base font-medium text-green-600 mt-1">
                            {item.price && item.price.startsWith('RP') ? item.price : `RP ${item.price}`}
                          </p>
                          <div className="flex items-center justify-between mt-4">
                            <DragHandle className="flex items-center p-2 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
                              <MoveVertical className="w-4 h-4 mr-1" />
                              <span className="text-xs">Drag here</span>
                            </DragHandle>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleEditItemClick(item)} className="flex items-center gap-1">
                                <Edit className="h-3.5 w-3.5" />
                                Edit
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => confirmDeleteItem(item.id)} className="flex items-center gap-1">
                                <Trash className="h-3.5 w-3.5" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </SortableItem>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </TabsContent>

          <TabsContent value="sauces">
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-4">Add Sauce</h2>
              <form onSubmit={handleAddSauceSubmit} className="space-y-4 border rounded-lg p-4" encType="multipart/form-data">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-2">Name</label>
                    <Input name="name" placeholder="Sauce name" required />
                  </div>
                  <div>
                    <label className="block mb-2">Image</label>
                    <Input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp" />
                  </div>
                </div>
                <div>
                  <label className="block mb-2">Description</label>
                  <Textarea name="description" placeholder="Sauce description" required />
                </div>
                <div>
                  <label className="block mb-2">Price</label>
                  <Input name="price" placeholder="Enter price (e.g., Rp 15.000)" required />
                </div>
                <Button type="submit" className="w-full">
                  Add Sauce
                </Button>
              </form>
            </div>
            <div className="mb-4">
              <h3 className="text-lg font-semibold flex items-center">
                <MoveVertical className="w-5 h-5 mr-2" />
                Drag to reorder sauces
              </h3>
              <p className="text-sm text-gray-600">Sauces will appear in this order on the public menu</p>
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleSauceDragEnd}
            >
              <SortableContext
                items={localSauces.map(sauce => sauce.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {localSauces.map((sauce: Sauce) => (
                    <SortableItem key={sauce.id} id={sauce.id}>
                      <Card className="border-2 border-dashed border-gray-200 hover:border-primary transition-colors">
                        <CardContent className="p-4">
                          <img
                            src={sauce.imageUrl}
                            alt={sauce.name}
                            className="w-full h-48 object-cover rounded-md mb-4"
                          />
                          <h3 className="font-semibold">{sauce.name}</h3>
                          <p className="text-sm text-gray-600">{sauce.description}</p>
                          <p className="text-base font-medium text-green-600 mt-1">
                            {sauce.price && sauce.price.startsWith('RP') ? sauce.price : `RP ${sauce.price}`}
                          </p>
                          <div className="flex items-center justify-between mt-4">
                            <DragHandle className="flex items-center p-2 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
                              <MoveVertical className="w-4 h-4 mr-1" />
                              <span className="text-xs">Drag here</span>
                            </DragHandle>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleEditSauceClick(sauce)} className="flex items-center gap-1">
                                <Edit className="h-3.5 w-3.5" />
                                Edit
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => confirmDeleteSauce(sauce.id)} className="flex items-center gap-1">
                                <Trash className="h-3.5 w-3.5" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </SortableItem>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </TabsContent>
        </Tabs>
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
                name="price"
                defaultValue={editingItem?.price}
                placeholder="Enter price (e.g., Rp 25.000)"
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
                name="price"
                defaultValue={editingSauce?.price}
                placeholder="Enter price (e.g., Rp 15.000)"
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

      <AlertDialog open={deleteItemId !== null} onOpenChange={() => setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this menu item.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteItemId && handleDeleteItem(deleteItemId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteSauceId !== null} onOpenChange={() => setDeleteSauceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this sauce.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteSauceId && handleDeleteSauce(deleteSauceId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}