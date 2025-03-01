import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface LogoDisplayProps {
  className?: string;
  logoUrl?: string;
}

export function LogoDisplay({ className, logoUrl }: LogoDisplayProps) {
  const [imageError, setImageError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string>(logoUrl || "/logo/logo.png");

  // Reset error state and update src when logoUrl changes
  useEffect(() => {
    console.log("LogoDisplay: Logo URL changed to:", logoUrl);
    setImageError(false);
    // Ensure the logo URL has the correct format
    if (logoUrl) {
      // If logoUrl starts with /logo/, make sure it's treated correctly
      const formattedLogoUrl = logoUrl.startsWith("/logo/") ? logoUrl : `/logo/${logoUrl.split('/').pop()}`;
      setCurrentSrc(formattedLogoUrl);
    } else {
      setCurrentSrc("/logo/logo.png");
    }
  }, [logoUrl]);

  const handleError = () => {
    console.error("LogoDisplay: Failed to load logo from:", currentSrc);
    setImageError(true);
    // Try with an alternate path format if the current one fails
    if (!imageError) {
      const altPath = currentSrc.includes('/logo/') 
        ? currentSrc.replace('/logo/', '/') 
        : `/logo/${currentSrc.split('/').pop()}`;
      console.log("LogoDisplay: Trying alternate path:", altPath);
      setCurrentSrc(altPath);
    } else {
      // If already tried alternate path, fall back to default
      setCurrentSrc("/logo/logo.png");
    }
  };

  console.log("LogoDisplay: Rendering with src:", currentSrc, "logoUrl:", logoUrl);

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
import React from 'react';

interface HalalLogoProps {
  className?: string;
}

export const HalalLogo: React.FC<HalalLogoProps> = ({ className }) => {
  return (
    <img
      src="/logo/halal.png"
      alt="Halal Certification"
      className={cn("w-[100px] h-[100px] object-contain", className)}
    />
  );
};