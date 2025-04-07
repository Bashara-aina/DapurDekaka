import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface Testimonial {
  id: string;
  name: string;
  position: string;
  company: string;
  image: string;
  content: string;
}

interface CustomersData {
  title: string;
  subtitle: string;
  logos: string[];
  testimonials: Testimonial[];
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
          setCustomersData(pageData.content.customers);
        } else {
          // Default data if not available
          setCustomersData({
            title: "Our Customers",
            subtitle: "Trusted by businesses across Indonesia",
            logos: [
              "/logo/logo.png",
              "/logo/halal.png",
              "/logo/logo.png",
              "/logo/halal.png",
              "/logo/logo.png",
              "/logo/halal.png"
            ],
            testimonials: []
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
    logos: ["/logo/logo.png", "/logo/halal.png", "/logo/logo.png", "/logo/halal.png", "/logo/logo.png", "/logo/halal.png"],
    testimonials: []
  };

  return (
    <section className="py-12 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900">{content.title}</h2>
          <p className="text-gray-600 mt-2">{content.subtitle}</p>
        </div>

        {/* Customer Logos */}
        <div className="relative overflow-hidden mb-16">
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes scroll {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            .marquee {
              animation: scroll 30s linear infinite;
              white-space: nowrap;
            }
          `}} />

          <div className="overflow-hidden">
            <div className="marquee inline-flex">
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

        {/* Testimonials */}
        {content.testimonials && content.testimonials.length > 0 && (
          <div className="mt-16">
            <h3 className="text-2xl font-bold text-center mb-8">What Our Customers Say</h3>
            
            <div className="grid md:grid-cols-2 gap-8">
              {content.testimonials.map((testimonial) => (
                <div key={testimonial.id} className="bg-white p-6 rounded-lg shadow-sm">
                  <p className="text-gray-700 italic mb-4">"{testimonial.content}"</p>
                  
                  <div className="flex items-center">
                    {testimonial.image && (
                      <img 
                        src={testimonial.image} 
                        alt={testimonial.name}
                        className="w-12 h-12 rounded-full object-cover mr-4"
                      />
                    )}
                    <div>
                      <h4 className="font-semibold">{testimonial.name}</h4>
                      <p className="text-sm text-gray-600">{testimonial.position}, {testimonial.company}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}