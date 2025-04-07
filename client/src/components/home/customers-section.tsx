import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { cn } from "@/lib/utils";

export default function CustomersSection() {
  const { t } = useLanguage();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isAnimating, setIsAnimating] = useState(true);
  
  const { data: pageData } = useQuery({
    queryKey: ["pages", "homepage"],
    queryFn: async () => {
      const response = await fetch(`/api/pages/homepage`, {
        method: "GET",
        headers: {
          "Cache-Control": "max-age=300",
        },
      });
      if (!response.ok) throw new Error("Failed to fetch homepage data");
      const data = await response.json();
      return data;
    },
  });

  // Extract section title and subtitle
  const sectionTitle = pageData?.content?.customers?.title || "Our Customers";
  const sectionSubtitle = pageData?.content?.customers?.subtitle || "Trusted by businesses across Indonesia";
  
  // Use actual logos if available, otherwise use the default logo
  const customerLogos = pageData?.content?.customers?.logos || [pageData?.logo || "/logo/logo.png"];
  
  // If we only have one logo, duplicate it to create a proper carousel effect
  const displayLogos = customerLogos.length <= 1 
    ? [...customerLogos, ...customerLogos, ...customerLogos, ...customerLogos, ...customerLogos, ...customerLogos] 
    : [...customerLogos, ...customerLogos]; // Double the logos to make continuous scrolling easier

  // Set up automatic scrolling
  useEffect(() => {
    if (!scrollContainerRef.current || !isAnimating) return;
    
    const scrollContainer = scrollContainerRef.current;
    let animationId: number;
    
    const scroll = () => {
      if (!scrollContainer) return;
      
      // If we've scrolled to the halfway point, reset to the beginning
      if (scrollContainer.scrollLeft >= scrollContainer.scrollWidth / 2) {
        scrollContainer.scrollLeft = 0;
      } else {
        scrollContainer.scrollLeft += 1;
      }
      
      animationId = requestAnimationFrame(scroll);
    };
    
    animationId = requestAnimationFrame(scroll);
    
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isAnimating]);

  return (
    <section className="py-12 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900">{sectionTitle}</h2>
          <p className="text-gray-600 mt-2">{sectionSubtitle}</p>
        </div>

        <div className="relative overflow-hidden">
          <div 
            ref={scrollContainerRef}
            className="flex items-center overflow-x-auto scrollbar-hide"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            onMouseEnter={() => setIsAnimating(false)}
            onMouseLeave={() => setIsAnimating(true)}
          >
            {displayLogos.map((logo: string, index: number) => (
              <div 
                key={`${logo}-${index}`} 
                className="flex-none mx-4 md:mx-8 p-2"
                style={{ minWidth: "150px", maxWidth: "200px" }}
              >
                <img 
                  src={logo} 
                  alt={`Customer logo ${index + 1}`}
                  className="h-16 md:h-20 w-auto mx-auto object-contain filter grayscale hover:grayscale-0 transition-all duration-300"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}