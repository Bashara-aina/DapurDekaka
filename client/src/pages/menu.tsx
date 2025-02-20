import { motion } from "framer-motion";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { queryKeys, apiRequest } from "@/lib/queryClient";
import { MenuItem, Sauce } from "@shared/schema";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function Menu() {
  const { t } = useLanguage();
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
        <h1 className="text-4xl font-bold text-gray-900 mb-4">{t('menu.title')}</h1>
        <p className="text-lg text-gray-600">
          {t('menu.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {menuItems?.map((item: MenuItem) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card>
              <CardContent className="p-4">
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-full h-48 object-cover rounded-md mb-4"
                />
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">{item.name}</h3>
                  <p className="text-sm text-gray-600">{item.description}</p>
                  <p className="font-medium">Rp {item.price.toLocaleString()}</p>
                  <div className="flex justify-center w-full">
                    <Button size="sm" asChild>
                      <a
                        href={`https://wa.me/your-number?text=I would like to order ${item.name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t('menu.orderButton')}
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="mt-16">
        <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">{t('menu.sauces.title')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {sauces?.map((sauce: Sauce) => (
            <motion.div
              key={sauce.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card>
                <CardContent className="p-4">
                  <img
                    src={sauce.imageUrl}
                    alt={sauce.name}
                    className="w-full h-48 object-cover rounded-md mb-4"
                  />
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg">{sauce.name}</h3>
                    <p className="text-sm text-gray-600">{sauce.description}</p>
                    <p className="font-medium">Rp {sauce.price.toLocaleString()}</p>
                    <div className="flex justify-center w-full">
                      <Button size="sm" asChild>
                        <a
                          href={`https://wa.me/your-number?text=I would like to order ${sauce.name}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t('menu.orderButton')}
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}