import { useRef } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { menuData } from "@shared/menu-data";
import { useQuery } from "@tanstack/react-query";

export default function FeaturedProducts() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: pageData } = useQuery({
    queryKey: ['homepage'],
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

  return (
    <section className="py-8 bg-white">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">
              {pageData?.content.featuredProducts.title || "Featured Products"}
            </h2>
            <p className="text-gray-600 mt-2">
              {pageData?.content.featuredProducts.subtitle || "Discover our most loved dim sum selections"}
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
          {menuData.slice(0, 11).map((item) => (
            <motion.div
              key={item.id}
              className="min-w-[220px] snap-start"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
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
    </section>
  );
}