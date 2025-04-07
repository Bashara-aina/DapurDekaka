import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function CustomersSection() {
  const { t } = useLanguage();
  
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
  
  // Use actual logos if available, otherwise create a demo set of 6 logos
  const defaultLogo = pageData?.logo || "/logo/logo.png";
  
  // Create an array of 6 different logos for demo purposes
  // In a real scenario, these would come from the API
  const customerLogos = pageData?.content?.customers?.logos || [
    defaultLogo,
    "/logo/halal.png",
    defaultLogo,
    "/logo/halal.png",
    defaultLogo,
    "/logo/halal.png"
  ];

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900">{sectionTitle}</h2>
          <p className="text-gray-600 mt-2">{sectionSubtitle}</p>
        </div>

        <div className="relative overflow-hidden">
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
              {customerLogos.map((logo: string, index: number) => (
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
              {customerLogos.map((logo: string, index: number) => (
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