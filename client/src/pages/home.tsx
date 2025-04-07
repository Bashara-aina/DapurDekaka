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
      try {
        const response = await fetch(`/api/pages/homepage`);
        if (!response.ok) return null;
        return await response.json();
      } catch (error) {
        console.error("Error fetching homepage data:", error);
        return null;
      }
    },
    staleTime: 300000, // Consider data fresh for 5 minutes
    refetchOnWindowFocus: false,
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
