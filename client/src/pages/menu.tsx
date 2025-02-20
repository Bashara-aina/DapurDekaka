import { motion } from "framer-motion";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { queryKeys, apiRequest } from "@/lib/queryClient";
import { MenuItem, Sauce } from "@shared/schema";

export default function Menu() {
  const { data: menuItems, isLoading: menuLoading } = useQuery({
    queryKey: queryKeys.menu.items,
    queryFn: () => apiRequest("/api/menu/items")
  });

  const { data: sauces, isLoading: saucesLoading } = useQuery({
    queryKey: queryKeys.menu.sauces,
    queryFn: () => apiRequest("/api/menu/sauces")
  });

  if (menuLoading || saucesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-2xl mx-auto text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Our Menu</h1>
        <p className="text-lg text-gray-600">
          Discover our selection of premium halal dim sum, handcrafted with care and quality ingredients
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {menuItems?.map((item: MenuItem, index: number) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <Card className="h-full flex flex-col">
              <CardContent className="p-0 relative pb-[133.33%]">
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </CardContent>
              <CardFooter className="flex flex-col items-start gap-2 p-4 h-[250px]">
                <h3 className="font-semibold text-lg">{item.name}</h3>
                <p className="text-sm text-gray-600 flex-1">{item.description}</p>
                <div className="flex justify-center w-full">
                  <Button size="sm" asChild>
                    <a
                      href={`https://wa.me/your-number?text=I would like to order ${item.name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Pesan
                    </a>
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="mt-16">
        <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Our Special Sauces</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {sauces?.map((sauce: Sauce, index: number) => (
            <motion.div
              key={sauce.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="h-full flex flex-col">
                <CardContent className="p-0 relative pb-[100%]">
                  <img
                    src={sauce.imageUrl}
                    alt={sauce.name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </CardContent>
                <CardFooter className="flex flex-col items-start gap-2 p-4 flex-grow">
                  <h3 className="font-semibold text-lg">{sauce.name}</h3>
                  <p className="text-sm text-gray-600 line-clamp-3">{sauce.description}</p>
                  <div className="flex justify-center w-full mt-auto pt-2">
                    <Button size="sm" asChild>
                      <a
                        href={`https://wa.me/your-number?text=I would like to order ${sauce.name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Pesan
                      </a>
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}