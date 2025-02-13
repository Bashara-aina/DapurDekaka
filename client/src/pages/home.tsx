import EntranceSection from "@/components/entrance-screen";
import HeroSection from "@/components/home/hero-section";
import FeaturedProducts from "@/components/home/featured-products";
import FeaturedArticles from "@/components/home/featured-articles";

export default function Home() {
  return (
    <div className="relative">
      <EntranceSection />
      <div className="relative z-10">
        <HeroSection />
        <FeaturedProducts />
        <FeaturedArticles />
      </div>
    </div>
  );
}