import HeroSection from "@/components/home/hero-section";
import FeaturedProducts from "@/components/home/featured-products";
import FeaturedArticles from "@/components/home/featured-articles";

export default function Home() {
  return (
    <div>
      <HeroSection />
      <FeaturedProducts />
      <FeaturedArticles />
    </div>
  );
}