import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface LogoDisplayProps {
  className?: string;
  logoUrl?: string;
}

export function LogoDisplay({ className, logoUrl }: LogoDisplayProps) {
  const [imageError, setImageError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string>(logoUrl || "/logo/logo.png");

  useEffect(() => {
    setImageError(false);

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 10);
    const baseUrl = logoUrl ? logoUrl.split('?')[0] : '/logo/logo.png';
    const url = `${baseUrl}?nocache=${timestamp}-${randomStr}`;

    fetch(baseUrl, { 
      method: 'HEAD',
      cache: 'no-store',
      headers: { 'Pragma': 'no-cache' }
    })
      .then(res => {
        if (res.ok) {
          setCurrentSrc('');
          document.body.offsetHeight;
          setTimeout(() => {
            setCurrentSrc(url);
          }, 100);
        } else {
          setImageError(true);
          setCurrentSrc(`/logo/logo.png?fallback=${timestamp}`);
        }
      })
      .catch(() => {
        setImageError(true);
        setCurrentSrc(`/logo/logo.png?fallback=${timestamp}`);
      });
  }, [logoUrl]);

  const handleError = () => {
    setImageError(true);
    const fallbackUrl = `/logo/logo.png?fallback=${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    setCurrentSrc(fallbackUrl);
  };

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <img 
        src={currentSrc}
        alt="Dekaka Logo" 
        className="w-[200px] h-[200px] object-contain"
        onError={handleError}
      />
    </div>
  );
}

// New component for Halal logo
interface HalalLogoProps {
  className?: string;
}

export function HalalLogo({ className }: HalalLogoProps) {
  return (
    <img
      src="/logo/halal.png"
      alt="Halal Certification"
      className={cn("w-[100px] h-[100px] object-contain", className)}
    />
  );
}