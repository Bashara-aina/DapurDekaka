import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface CustomersData {
  title: string;
  subtitle: string;
  logos: string[];
}

export default function CustomersSection() {
  const { t } = useLanguage();
  const [customersData, setCustomersData] = useState<CustomersData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Fetch data directly to ensure it's always fresh
  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/pages/homepage`, {
          method: "GET",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
          },
        });
        
        if (!response.ok) throw new Error("Failed to fetch homepage data");
        const pageData = await response.json();
        
        // Extract customers section data
        if (pageData?.content?.customers) {
          setCustomersData({
            title: pageData.content.customers.title || "Our Customers",
            subtitle: pageData.content.customers.subtitle || "Trusted by businesses across Indonesia",
            logos: pageData.content.customers.logos || [
              "/logo/logo.png",
              "/logo/halal.png",
              "/logo/logo.png", 
              "/logo/halal.png"
            ]
          });
        } else {
          // Default data if not available
          setCustomersData({
            title: "Our Customers",
            subtitle: "Trusted by businesses across Indonesia",
            logos: [
              "/logo/logo.png",
              "/logo/halal.png",
              "/logo/logo.png",
              "/logo/halal.png"
            ]
          });
        }
      } catch (error) {
        console.error("Error fetching customers data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <section className="py-12">
        <div className="container mx-auto px-4 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        </div>
      </section>
    );
  }

  // Ensure we have data
  const content = customersData || {
    title: "Our Customers",
    subtitle: "Trusted by businesses across Indonesia",
    logos: ["/logo/logo.png", "/logo/halal.png", "/logo/logo.png", "/logo/halal.png"]
  };

  // Don't render if no logos available
  if (!content.logos || content.logos.length === 0) {
    return null;
  }

  return (
    <section className="py-12 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900">{content.title}</h2>
          <p className="text-gray-600 mt-2">{content.subtitle}</p>
        </div>

        {/* Customer Logos with enhanced scrolling effect */}
        <div className="relative overflow-hidden">
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes scrollX {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            .logo-marquee {
              display: flex;
              width: max-content;
              animation: scrollX 25s linear infinite;
            }
            .logo-marquee:hover {
              animation-play-state: paused;
            }
          `}} />

          <div className="overflow-hidden w-full relative">
            <div className="logo-marquee">
              {/* First set of logos */}
              {content.logos.map((logo: string, index: number) => (
                <div 
                  key={`logo-1-${index}`} 
                  className="flex-none mx-4 md:mx-8 p-2"
                  style={{ minWidth: "150px" }}
                >
                  <img 
                    src={logo} 
                    alt={`Customer logo ${index + 1}`}
                    className="h-20 md:h-24 w-auto mx-auto object-contain hover:scale-110 transition-all duration-300"
                  />
                </div>
              ))}
              
              {/* Duplicate set for seamless looping */}
              {content.logos.map((logo: string, index: number) => (
                <div 
                  key={`logo-2-${index}`} 
                  className="flex-none mx-4 md:mx-8 p-2"
                  style={{ minWidth: "150px" }}
                >
                  <img 
                    src={logo} 
                    alt={`Customer logo ${index + 1}`}
                    className="h-20 md:h-24 w-auto mx-auto object-contain hover:scale-110 transition-all duration-300"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}