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
      // Debug log: Log all form fields before sending
      console.log('Form data being sent:');
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log(`${key}: File(${value.name}, ${value.type}, ${value.size} bytes)`);
        } else {
          console.log(`${key}: ${value}`);
        }
      }

      const response = await fetch("/api/menu/items", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create menu item: ${error}`);
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
      console.error('Mutation error:', error);
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

    // Debug log: Log form fields before mutation
    console.log('FormData fields before submission:');
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(`${key}: File(${value.name}, ${value.type}, ${value.size} bytes)`);
      } else {
        console.log(`${key}: ${value}`);
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
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
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
                <label htmlFor="imageFile" className="text-sm font-medium">Image</label>
                <Input
                  id="imageFile"
                  name="imageFile"
                  type="file"
                  accept="image/*"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
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