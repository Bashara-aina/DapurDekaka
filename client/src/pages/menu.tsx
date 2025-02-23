import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { queryKeys, apiRequest } from "@/lib/queryClient";
import { MenuItem, Sauce } from "@shared/schema";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import AspectRatio from "@/components/ui/aspect-ratio";

export default function Menu() {
  const { t } = useLanguage();
  const { data: menuItems, isLoading: menuLoading } = useQuery({
    queryKey: queryKeys.menu.items,
    queryFn: () => apiRequest("/api/menu/items"),
  });

  const { data: sauces, isLoading: saucesLoading } = useQuery({
    queryKey: queryKeys.menu.sauces,
    queryFn: () => apiRequest("/api/menu/sauces"),
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
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          {t("menu.title")}
        </h1>
      </div>

      {/* Menu Items - 4 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {menuItems?.map((item: MenuItem) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col h-full"
          >
            <Card className="h-full flex flex-col">
              <CardContent className="p-0 flex flex-col h-full">
                <AspectRatio ratio={1} className="overflow-hidden rounded-lg">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="object-cover w-full h-full"
                  />
                </AspectRatio>
                <div className="p-4 flex flex-col flex-grow gap-3">
                  <h3 className="text-lg font-semibold">{item.name}</h3>
                  <p className="text-sm text-gray-600">
                    {item.description}
                  </p>
                  <div className="mt-auto pt-2">
                    <Button
                      className="w-full"
                      variant="default"
                      size="sm"
                      asChild
                    >
                      <a
                        href={`https://wa.me/your-number?text=I would like to order ${item.name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full"
                      >
                        Pesan
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Sauces - 3 columns */}
      {sauces && sauces.length > 0 && (
        <div className="mt-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            {t("menu.sauces.title")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {sauces.map((sauce: Sauce) => (
              <motion.div
                key={sauce.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col h-full"
              >
                <Card className="h-full flex flex-col">
                  <CardContent className="p-0">
                    <AspectRatio ratio={1} className="overflow-hidden rounded-lg">
                      <img
                        src={sauce.imageUrl}
                        alt={sauce.name}
                        className="object-cover w-full h-full"
                      />
                    </AspectRatio>
                    <div className="p-4 flex flex-col gap-2">
                      <h3 className="text-lg font-semibold">{sauce.name}</h3>
                      <p className="text-sm text-gray-600 flex-grow">
                        {sauce.description}
                      </p>
                      <Button
                        className="w-full mt-2"
                        variant="default"
                        size="sm"
                        asChild
                      >
                        <a
                          href={`https://wa.me/your-number?text=I would like to order ${sauce.name}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full"
                        >
                          Pesan
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}