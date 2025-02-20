
import { useRef } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function FeaturedProducts() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  const { data: menuItems, isLoading: menuLoading } = useQuery({
    queryKey: ['menu', 'items'],
    queryFn: async () => {
      const response = await fetch('/api/menu/items');
      if (!response.ok) throw new Error('Failed to fetch menu items');
      return response.json();
    }
  });

  const { data: pageData } = useQuery({
    queryKey: ['pages', 'homepage'],
    queryFn: async () => {
      const response = await fetch('/api/pages/homepage');
      if (!response.ok) throw new Error('Failed to fetch homepage data');
      return response.json();
    }
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

  return (
    <section className="py-8 bg-white">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">
              {t('home.featured.title')}
            </h2>
            <p className="text-gray-600 mt-2">
              {t('home.featured.subtitle')}
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
          className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {menuItems?.slice(0, 11).map((item) => (
            <motion.div
              key={item.id}
              className="min-w-[220px] snap-start"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="h-full flex flex-col">
                <div className="aspect-[4/3] relative overflow-hidden">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="absolute inset-0 w-full h-full object-cover rounded-t-lg"
                  />
                </div>
                <CardFooter className="flex flex-col items-start gap-2 p-4 min-h-[180px]">
                  <h3 className="font-semibold text-base">{item.name}</h3>
                  <p className="text-sm text-gray-600 flex-1">
                    {item.description}
                  </p>
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
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
