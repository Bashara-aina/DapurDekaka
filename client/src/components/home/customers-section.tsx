import { useLanguage } from "@/lib/i18n/LanguageContext";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface CustomersData {
  title: string;
  subtitle: string;
  logos: string[];
}

export default function CustomersSection() {
  const { t } = useLanguage();

  const { data: pageData, isLoading, isError } = useQuery<{ success: boolean; content?: { customers: CustomersData } }>({
    queryKey: ["pages", "homepage"],
    queryFn: async () => {
      const response = await fetch("/api/pages/homepage");
      if (!response.ok) throw new Error("Failed to fetch homepage data");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const customersData = pageData?.content?.customers ?? null;

  if (isLoading) {
    return (
      <section className="py-12">
        <div className="container mx-auto px-4 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        </div>
      </section>
    );
  }

  if (isError || !customersData) {
    return null;
  }

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>, logo: string) => {
    e.currentTarget.src = '/logo/logo.png';
  };

  return (
    <section className="py-12 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900">{customersData.title}</h2>
          <p className="text-gray-600 mt-2">{customersData.subtitle}</p>
        </div>

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
              {customersData.logos.map((logo: string, index: number) => (
                <div
                  key={`logo-1-${index}`}
                  className="flex-none mx-4 md:mx-8 p-2"
                  style={{ minWidth: "150px" }}
                >
                  <img
                    src={logo}
                    alt={`Customer logo ${index + 1}`}
                    className="h-20 md:h-24 w-auto mx-auto object-contain hover:scale-110 transition-all duration-300"
                    onError={(e) => handleImageError(e, logo)}
                  />
                </div>
              ))}

              {customersData.logos.map((logo: string, index: number) => (
                <div
                  key={`logo-2-${index}`}
                  className="flex-none mx-4 md:mx-8 p-2"
                  style={{ minWidth: "150px" }}
                >
                  <img
                    src={logo}
                    alt={`Customer logo ${index + 1}`}
                    className="h-20 md:h-24 w-auto mx-auto object-contain hover:scale-110 transition-all duration-300"
                    onError={(e) => handleImageError(e, logo)}
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