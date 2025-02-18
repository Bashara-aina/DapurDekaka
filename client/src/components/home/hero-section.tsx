
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function HeroSection() {
  const { data: pageData, isLoading } = useQuery({
    queryKey: ['/api/pages/homepage'],
    queryFn: async () => {
      const response = await fetch('/api/pages/homepage', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch homepage data');
      return response.json();
    },
    refetchOnMount: true,
    staleTime: 0
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <section className="relative h-screen bg-white overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img
          src="/asset/1.jpg"
          alt="Hero Background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/50" />
      </div>

      <div className="relative z-10 h-full flex items-center justify-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto px-4"
        >
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
            {pageData?.content.hero.title}
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-4">
            {pageData?.content.hero.subtitle}
          </p>
          <p className="text-lg md:text-xl text-white/80 mb-8">
            {pageData?.content.hero.description}
          </p>
          <Button size="lg" asChild className="bg-primary hover:bg-primary/90">
            <a href="#menu">Explore Menu</a>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
