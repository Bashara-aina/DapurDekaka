import EntranceSection from "@/components/entrance-screen";
import FeaturedProducts from "@/components/home/featured-products";
import FeaturedArticles from "@/components/home/featured-articles";
import CustomersSection from "@/components/home/customers-section";

export default function Home() {
  return (
    <div className="relative">
      <EntranceSection />
      <div className="relative z-10">
        <FeaturedProducts />
        <FeaturedArticles />
        <CustomersSection />
      </div>
    </div>
  );
}
