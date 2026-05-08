import { useRef } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { OrderModal } from "@/components/OrderModal";
import { ImageOptimizer } from "@/components/ImageOptimizer";
import type { MenuItem } from "@shared/schema";

export default function FeaturedProducts() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  const { data: response, isLoading: menuLoading, isError: menuError } = useQuery({
    queryKey: ["menu", "items"],
    queryFn: async () => {
      const response = await fetch("/api/menu/items");
      if (!response.ok) throw new Error("Failed to fetch menu items");
      const json = await response.json();
      return json.data?.menuItems || json.data || [];
    },
    staleTime: 60000,
  });

  const menuItems = Array.isArray(response) ? response : response?.menuItems || [];

  const { data: pageData } = useQuery({
    queryKey: ["pages", "homepage"],
    queryFn: async () => {
      const response = await fetch("/api/pages/homepage");
      if (!response.ok) throw new Error("Failed to fetch homepage data");
      return response.json();
    },
    // Homepage config changes rarely, so we can safely cache it for a while.
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = direction === "left" ? -300 : 300;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  if (menuLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (menuError) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="max-w-md w-full p-6 text-center">
          <p className="text-destructive mb-4">{t('common.messages.error')}</p>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
          >
            {t('common.buttons.retry')}
          </Button>
        </Card>
      </div>
    );
  }

  if (!menuItems || menuItems.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="max-w-md w-full p-6 text-center">
          <p className="text-muted-foreground">No items available.</p>
        </Card>
      </div>
    );
  }

  return (
    <section className="py-8 bg-white">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <div className="w-4/5">
            <h2 className="text-3xl font-bold text-gray-900">
              {t("home.featured.title")}
            </h2>
            <p className="text-gray-600 mt-2 pr-4">
              {t("home.featured.subtitle")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => scroll("left")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => scroll("right")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-4"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {menuItems?.slice(0, 11).map((item: MenuItem) => (
            <motion.div
              key={item.id}
              className="min-w-[280px] w-[280px] snap-start"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="h-full flex flex-col">
                <AspectRatio ratio={1} className="overflow-hidden rounded-t-lg">
                  <ImageOptimizer
                    src={item.imageUrl}
                    alt={item.name}
                    width={280}
                    height={280}
                    sizes="280px"
                    className="object-cover w-full h-full"
                  />
                </AspectRatio>
                <CardContent className="flex-1 p-4">
                  <h3 className="font-semibold text-base">{item.name}</h3>
                  <p className="text-sm text-gray-600 line-clamp-4 mt-2">
                    {item.description}
                  </p>
                </CardContent>
                <CardFooter className="p-4 pt-0">
                  <OrderModal 
                    trigger={
                      <Button size="sm" className="w-full">
                        {t('common.buttons.order')}
                      </Button>
                    }
                    menuItem={item}
                  />
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
