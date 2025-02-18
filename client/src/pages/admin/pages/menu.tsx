
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { MenuItem } from "@shared/schema";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";

export default function AdminMenuPage() {
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items, isLoading } = useQuery<MenuItem[]>({
    queryKey: ["/api/menu"],
    queryFn: async () => {
      const response = await fetch("/api/menu");
      if (!response.ok) throw new Error("Failed to fetch menu items");
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/menu", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to create item");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu"] });
      toast({ title: "Success", description: "Menu item created successfully" });
      setIsEditing(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: number; formData: FormData }) => {
      const response = await fetch(`/api/menu/${id}`, {
        method: "PUT",
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to update item");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu"] });
      toast({ title: "Success", description: "Menu item updated successfully" });
      setIsEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/menu/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete item");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu"] });
      toast({ title: "Success", description: "Menu item deleted successfully" });
    },
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      if (editingItem) {
        await updateMutation.mutateAsync({ id: editingItem.id, formData });
      } else {
        await createMutation.mutateAsync(formData);
      }
      setEditingItem(null);
    } catch (error) {
      console.error('Error:', error);
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
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Menu Management</h1>
        <Button onClick={() => setIsEditing(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Menu Item
        </Button>
      </div>

      <Sheet open={isEditing} onOpenChange={setIsEditing}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle>{editingItem ? 'Edit Menu Item' : 'Add Menu Item'}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <Input
                name="name"
                placeholder="Item Name"
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
                type="number"
                name="price"
                placeholder="Price"
                defaultValue={editingItem?.price}
                required
              />
            </div>
            <div>
              <Input
                name="category"
                placeholder="Category"
                defaultValue={editingItem?.category}
                required
              />
            </div>
            <div>
              <Input
                type="file"
                name="image"
                accept="image/*"
              />
            </div>
            <Button type="submit">
              {editingItem ? 'Update' : 'Create'} Menu Item
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items?.map((item) => (
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
                      setEditingItem(item);
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
                        deleteMutation.mutate(item.id);
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
    </div>
  );
}
