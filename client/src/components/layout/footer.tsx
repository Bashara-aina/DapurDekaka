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
          <svg className="h-5 w-5" viewBox="0 0 21000 29700" fill="#009C3D">
            <path d="M16712 13354l0 -2548 522 0 0 2190c-142,71 -341,207 -522,358zm-908 766l0 0c160,-192 326,-387 522,-552l0 -2762 -522 0 0 3314zm-6053 2025l0 0c0,681 271,1326 763,1819 492,491 1138,762 1819,762 288,0 584,-62 794,-165l0 -522c-245,103 -541,164 -794,164 -1116,0 -2059,-942 -2059,-2058l0 -471c0,-1116 943,-2059 2059,-2059 554,0 1073,213 1459,599 387,387 599,905 599,1460l0 3052 523 0 0 -3153c-32,-666 -317,-1289 -801,-1755 -484,-468 -1117,-726 -1780,-726 -681,0 -1327,271 -1819,763 -492,492 -763,1138 -763,1819l0 471zm7822 -1250l0 0c236,-236 544,-372 846,-372 645,0 1151,506 1151,1151l0 471c0,645 -506,1151 -1151,1151 -313,0 -614,-172 -851,-482 -209,-275 -345,-646 -366,-979l-424 516c84,396 291,775 582,1041 302,275 678,427 1059,427 923,0 1674,-751 1674,-1674l0 -471c0,-437 -178,-855 -498,-1175 -322,-322 -739,-499 -1176,-499 -277,0 -716,99 -1240,570l-1 2c-141,140 -470,469 -670,704 -337,367 -825,921 -1242,1476l0 817c462,-595 728,-927 1163,-1429 389,-455 871,-1006 1144,-1245zm-12343 -986l0 0 0 -618c-472,-254 -989,-367 -1673,-367 -699,0 -1361,257 -1865,721 -505,466 -784,1079 -784,1726l0 169c0,1349 1083,2446 2413,2446 1083,0 1527,-354 1640,-465l0 -1571 -1767 0 0 523 1278 0 0 787 -5 1c-164,65 -506,203 -1146,203 -507,0 -982,-198 -1338,-558 -356,-360 -552,-846 -552,-1366l0 -169c0,-1043 973,-1924 2126,-1924 797,0 1268,130 1673,462zm3807 614l0 0c199,0 367,33 501,98 65,-162 132,-296 229,-458 -142,-102 -480,-163 -730,-163 -953,0 -1673,719 -1673,1674l0 3052 523 0 0 -3052c0,-678 473,-1151 1150,-1151zm-9037 848l0 0 0 169c0,906 344,1752 969,2381 623,628 1459,973 2352,973 719,0 1355,-162 1892,-482 443,-264 639,-531 656,-555l0 -2815 -2675 0 0 524 2152 0 0 2128 -2 3c-252,252 -850,674 -2023,674 -764,0 -1472,-291 -1993,-821 -520,-528 -805,-1242 -805,-2010l0 -169c0,-726 327,-1450 897,-1985 582,-546 1341,-847 2137,-847 741,0 1259,113 1673,365l0 -588c-432,-184 -948,-266 -1673,-266 -1928,0 -3557,1521 -3557,3321zm14006 3355l0 0 0 -3052c0,-939 -735,-1674 -1673,-1674 -438,0 -855,177 -1176,499 -321,320 -498,738 -498,1175l0 471c0,906 767,1674 1674,1674 248,0 587,-62 794,-232l0 -552c-204,163 -499,261 -794,261 -645,0 -1151,-506 -1151,-1151l0 -471c0,-645 506,-1151 1151,-1151 646,0 1151,506 1151,1151l0 3052 522 0zm-4969 -5111l0 0c356,0 663,76 940,233 130,-162 263,-295 360,-392 -293,-225 -790,-364 -1300,-364 -726,0 -1385,262 -1856,738 -467,472 -725,1127 -725,1844l0 3052 522 0 0 -3052c0,-1212 847,-2059 2059,-2059zm11201 240l0 0c-492,-492 -1138,-763 -1819,-763 -498,0 -999,185 -1274,369 -569,379 -1037,791 -1879,1879l0 782c715,-931 1391,-1664 1904,-2068 338,-271 817,-439 1249,-439 1116,0 2058,943 2058,2059l0 471c0,551 -217,1070 -611,1459 -391,387 -905,599 -1447,599 -917,0 -1724,-629 -1943,-1488l-369 446c269,901 1240,1565 2312,1565 681,0 1327,-271 1819,-762 492,-493 762,-1138 762,-1819l0 -471c0,-681 -270,-1327 -762,-1819z" />
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
