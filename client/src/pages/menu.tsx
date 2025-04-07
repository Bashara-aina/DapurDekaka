import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { queryKeys, apiRequest } from "@/lib/queryClient";
import { MenuItem, Sauce } from "@shared/schema";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { OrderModal } from "@/components/OrderModal";
import { useToast } from "@/hooks/use-toast";

export default function Menu() {
  const { t } = useLanguage();
  const { toast } = useToast();

  const { data: menuItems, isLoading: menuLoading, error: menuError } = useQuery({
    queryKey: queryKeys.menu.items,
    queryFn: () => apiRequest("/api/menu/items"),
    retry: 2
  });

  const { data: sauces, isLoading: saucesLoading, error: saucesError } = useQuery({
    queryKey: queryKeys.menu.sauces,
    queryFn: () => apiRequest("/api/menu/sauces"),
    retry: 2
  });

  if (menuLoading || saucesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (menuError || saucesError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <h2 className="text-xl font-semibold text-red-600">
          {t("errors.loading")}
        </h2>
        <Button onClick={() => window.location.reload()}>
          {t("actions.retry")}
        </Button>
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
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.src = '/placeholder-image.jpg'; // Add a placeholder image
                      console.error(`Failed to load image: ${item.imageUrl}`);
                    }}
                  />
                </AspectRatio>
                <div className="p-4 flex flex-col flex-grow gap-3">
                  <h3 className="text-lg font-semibold">{item.name}</h3>
                  <p className="text-sm text-gray-600">
                    {item.description}
                  </p>
                  <p className="text-base font-semibold text-green-600">
                    {item.price && item.price.startsWith('RP') ? item.price : `RP ${item.price}`}
                  </p>
                  <div className="mt-auto pt-2">
                    <OrderModal
                      trigger={<Button className="w-full">Pesan</Button>}
                      menuItem={item}
                    />
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
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          img.src = '/placeholder-image.jpg'; // Add a placeholder image
                          console.error(`Failed to load image: ${sauce.imageUrl}`);
                        }}
                      />
                    </AspectRatio>
                    <div className="p-4 flex flex-col gap-2">
                      <h3 className="text-lg font-semibold">{sauce.name}</h3>
                      <p className="text-sm text-gray-600 flex-grow">
                        {sauce.description}
                      </p>
                      <p className="text-base font-semibold text-green-600 mb-2">
                        {sauce.price && sauce.price.startsWith('RP') ? sauce.price : `RP ${sauce.price}`}
                      </p>
                      <OrderModal
                        trigger={<Button className="w-full">Pesan</Button>}
                        menuItem={sauce}
                      />
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