import EntranceSection from "@/components/entrance-screen";
import FeaturedProducts from "@/components/home/featured-products";
import FeaturedArticles from "@/components/home/featured-articles";
import CustomersSection from "@/components/home/customers-section";
import { SEOHead } from "@/components/SEOHead";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useQuery } from "@tanstack/react-query";

export default function Home() {
  const { t } = useLanguage();
  
  // Fetch homepage data for dynamic SEO content if available
  const { data: pageData } = useQuery({
    queryKey: ["pages", "homepage"],
    queryFn: async () => {
      const response = await fetch(`/api/pages/homepage`);
      if (!response.ok) throw new Error("Failed to fetch homepage data");
      return response.json();
    },
    staleTime: 300000,
    refetchOnWindowFocus: false,
    throwOnError: false,
  });
  
  // Extract title and description from page data if available
  const title = pageData?.content?.hero?.title || "Dapur Dekaka | Premium Halal Dim Sum";
  const description = pageData?.content?.hero?.subtitle || "Nikmati Sensasi Dimsum Premium dengan Cita Rasa Autentik!";
  // Use first carousel image if available, otherwise fallback
  const ogImage = pageData?.carousel?.images?.[0] || "/asset/1.jpg";
  
  return (
    <div className="relative">
      <SEOHead 
        title={title}
        description={description}
        keywords="halal dim sum, premium dim sum, Indonesian dim sum, Dapur Dekaka, authentic dim sum"
        ogImage={ogImage}
      />
      <EntranceSection />
      <div className="relative z-10">
        <FeaturedProducts />
        <FeaturedArticles />
        <CustomersSection />
      </div>
    </div>
  );
}
