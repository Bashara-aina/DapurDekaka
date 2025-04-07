import { MapPin, Phone, Mail, Instagram, ShoppingBag } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";

interface SocialLink {
  id: string;
  platform: string;
  url: string;
  icon: string;
}

interface FooterContent {
  companyName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  socialLinks: SocialLink[];
  copyright: string;
  logoUrl?: string;
}

export default function Footer() {
  const [footerData, setFooterData] = useState<FooterContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch footer data directly to ensure it's always fresh
  useEffect(() => {
    async function fetchFooterData() {
      try {
        setIsLoading(true);
        const response = await fetch("/api/pages/footer");
        if (response.ok) {
          const data = await response.json();
          setFooterData(data.content);
        }
      } catch (error) {
        console.error("Failed to fetch footer data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchFooterData();
  }, []);

  const renderSocialIcon = (icon: string) => {
    switch (icon) {
      case "Instagram":
        return <Instagram className="h-5 w-5" />;
      case "Shopee":
        return <ShoppingBag className="h-5 w-5" />;
      case "WhatsApp":
        return (
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
          </svg>
        );
      case "Grab":
        return (
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm1.316 16.529a4.528 4.528 0 01-4.523-4.523 4.528 4.528 0 014.523-4.523 4.528 4.528 0 014.523 4.523 4.528 4.528 0 01-4.523 4.523zm0-14.85c-5.699 0-10.327 4.628-10.327 10.327 0 5.699 4.628 10.327 10.327 10.327 5.699 0 10.327-4.628 10.327-10.327 0-5.699-4.628-10.327-10.327-10.327zm0 14.85a4.528 4.528 0 01-4.523-4.523 4.528 4.528 0 014.523-4.523 4.528 4.528 0 014.523 4.523 4.528 4.528 0 01-4.523 4.523z" />
          </svg>
        );
      default:
        return <Instagram className="h-5 w-5" />;
    }
  };

  if (isLoading) {
    return (
      <footer className="bg-gray-50 border-t">
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="space-y-2 w-full max-w-md">
              <Skeleton className="h-6 w-48 mx-auto" />
              <Skeleton className="h-4 w-full mx-auto" />
            </div>
            <div className="mt-4 space-y-2 w-full max-w-md">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-48" />
            </div>
            <div className="mt-6 flex justify-center gap-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <div className="mt-8">
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        </div>
      </footer>
    );
  }

  // Default content if footer data is not loaded
  const defaultFooter = {
    companyName: "Dapur Dekaka",
    tagline: "Premium halal dim sum made with love and quality ingredients.",
    address: "Jl. Sinom V No.7, Turangga, Kec. Lengkong, Kota Bandung, Jawa Barat 40264",
    phone: "082295986407",
    email: "contact@dapurdekaka.com",
    socialLinks: [
      {
        id: "1",
        platform: "Instagram",
        url: "https://instagram.com/dapurdekaka",
        icon: "Instagram"
      },
      {
        id: "2",
        platform: "Shopee",
        url: "https://shopee.co.id/dapurdekaka",
        icon: "Shopee"
      },
      {
        id: "3",
        platform: "WhatsApp",
        url: "https://wa.me/6282295986407",
        icon: "WhatsApp"
      },
      {
        id: "4",
        platform: "Grab",
        url: "https://food.grab.com/id/en/restaurant/dapur-dekaka-dimsum-delivery/",
        icon: "Grab"
      }
    ],
    copyright: `© ${new Date().getFullYear()} Dapur Dekaka. All rights reserved.`
  };

  // Use fetched data or default if not available
  const content = footerData || defaultFooter;

  return (
    <footer className="bg-gray-50 border-t">
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-primary">
              {content.companyName}
            </h3>
            <p className="text-gray-600">
              {content.tagline}
            </p>
          </div>

          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-center gap-2 text-gray-600">
              <MapPin className="h-5 w-5 flex-shrink-0" />
              <span>{content.address}</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-gray-600">
              <Phone className="h-5 w-5 flex-shrink-0" />
              <span>{content.phone}</span>
            </div>
            {content.email && (
              <div className="flex items-center justify-center gap-2 text-gray-600">
                <Mail className="h-5 w-5 flex-shrink-0" />
                <span>{content.email}</span>
              </div>
            )}
          </div>

          {content.socialLinks.length > 0 && (
            <div className="mt-6 flex justify-center space-x-4">
              {content.socialLinks.map((social) => (
                <a
                  key={social.id}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-primary transition-colors"
                >
                  {renderSocialIcon(social.icon)}
                </a>
              ))}
            </div>
          )}

          <div className="mt-8 text-gray-600">
            <p>{content.copyright}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
