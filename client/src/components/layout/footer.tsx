import { MapPin, Phone, Mail, Instagram, ShoppingBag } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

interface FooterContent {
  companyName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  socialLinks: {
    id: string;
    platform: string;
    url: string;
    icon: string;
  }[];
  copyright: string;
  logoUrl?: string;
}

export default function Footer() {
  const { data, isLoading } = useQuery<{ content: FooterContent }>({
    queryKey: ["/api/pages/footer"],
  });

  const footerData = data?.content;

  const renderSocialIcon = (icon: string) => {
    switch (icon) {
      case "Instagram":
        return <Instagram className="h-5 w-5" />;
      case "Shopee":
        return <ShoppingBag className="h-5 w-5" />;
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

  return (
    <footer className="bg-gray-50 border-t">
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-primary">
              {footerData?.companyName || "Dapur Dekaka"}
            </h3>
            <p className="text-gray-600">
              {footerData?.tagline || 
                "Premium halal dim sum made with love and quality ingredients."}
            </p>
          </div>

          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-center gap-2 text-gray-600">
              <MapPin className="h-5 w-5 flex-shrink-0" />
              <span>
                {footerData?.address || 
                  "Jl. Sinom V No.7, Turangga, Kec. Lengkong, Kota Bandung, Jawa Barat 40264"}
              </span>
            </div>
            <div className="flex items-center justify-center gap-2 text-gray-600">
              <Phone className="h-5 w-5 flex-shrink-0" />
              <span>{footerData?.phone || "082295986407"}</span>
            </div>
            {footerData?.email && (
              <div className="flex items-center justify-center gap-2 text-gray-600">
                <Mail className="h-5 w-5 flex-shrink-0" />
                <span>{footerData.email}</span>
              </div>
            )}
          </div>

          {footerData?.socialLinks && footerData.socialLinks.length > 0 && (
            <div className="mt-6 flex justify-center space-x-4">
              {footerData.socialLinks.map((social) => (
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
            <p>
              {footerData?.copyright || 
                `© ${new Date().getFullYear()} Dapur Dekaka. All rights reserved.`}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
