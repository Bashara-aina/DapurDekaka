import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { OrderModal } from "@/components/OrderModal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import Navbar from "@/components/layout/navbar";
import { MenuItem } from "@shared/schema";

export default function MenuPage() {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const { data: menuItems, isLoading } = useQuery<MenuItem[]>({
    queryKey: ["menu", "items"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/menu/items");
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        return response.json();
      } catch (error) {
        console.error("Failed to fetch menu items:", error);
        toast({
          title: "Error",
          description: "Failed to load menu items. Please try again later.",
          variant: "destructive",
        });
        return [];
      }
    },
  });

  const categories = ["all"];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto py-8">
          <div className="flex justify-center items-center h-[50vh]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">Our Menu</h1>

        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              onClick={() => setSelectedCategory(category)}
              className="whitespace-nowrap"
            >
              {category === "all" ? "All Items" : category}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems?.map((item) => (
            <div key={item.id} className="transition-all duration-300 hover:scale-[1.02]">
              <Card className="h-full flex flex-col">
                <AspectRatio ratio={1} className="overflow-hidden rounded-t-lg">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="object-cover w-full h-full"
                  />
                </AspectRatio>
                <CardContent className="flex-1 p-4 flex flex-col justify-between">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">{item.name}</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      {item.description}
                    </p>
                  </div>
                  <OrderModal
                    trigger={
                      <Button size="sm" className="w-full">
                        Pesan
                      </Button>
                    }
                    menuItem={item}
                  />
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}