import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function HeroSection() {
  const { data: pageData } = useQuery({
    queryKey: ['homepage'],
    queryFn: async () => {
      const response = await fetch('/api/pages/homepage');
      if (!response.ok) throw new Error('Failed to fetch homepage data');
      return response.json();
    }
  });

  if (!pageData) return null;

  return (
    <section className="relative py-24 bg-black/90 text-white">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            {pageData.content.hero.title}
          </h1>
          <p className="text-xl md:text-2xl mb-4 text-gray-300">
            {pageData.content.hero.subtitle}
          </p>
          <p className="mb-8 text-gray-400">
            {pageData.content.hero.description}
          </p>
          <Button size="lg" asChild>
            <Link href="/menu">View Our Menu</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
