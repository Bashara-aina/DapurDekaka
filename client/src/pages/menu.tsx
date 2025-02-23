import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { queryKeys, apiRequest } from "@/lib/queryClient";
import { MenuItem, Sauce } from "@shared/schema";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useState } from 'react';


// Modal Component
const OrderModal = ({ children }) => {
  const [showModal, setShowModal] = useState(false);

  const handleOpenModal = () => setShowModal(true);
  const handleCloseModal = () => setShowModal(false);

  return (
    <>
      <div onClick={handleOpenModal}>{children}</div>
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96 relative">
            <button
              className="absolute top-2 right-2"
              onClick={handleCloseModal}
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-4">Order Options</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <a
                href="https://shopee.co.id/dapurdekaka"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                {/* Shopee Logo Here */}
                <img src="/shopee-logo.svg" alt="Shopee" className="h-8 w-auto"/>
              </a>
              <a
                href="https://instagram.com/dapurdekaka"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                {/* Instagram Logo Here */}
                <img src="/instagram-logo.svg" alt="Instagram" className="h-8 w-auto"/>
              </a>
              <a
                href="https://mart.grab.com/id/id/merchant/6-C62BTTXXSB33TE"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                {/* Grab Logo Here */}
                <img src="/grab-logo.svg" alt="Grab" className="h-8 w-auto"/>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
};


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
                    <OrderModal>
                      <Button className="w-full" variant="default" size="sm">Pesan</Button>
                    </OrderModal>
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
                      <OrderModal>
                        <Button className="w-full mt-2" variant="default" size="sm">Pesan</Button>
                      </OrderModal>
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