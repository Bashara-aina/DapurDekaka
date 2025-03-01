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
    // Force browser to reload the image by adding/updating timestamp parameter
    const url = logoUrl ? 
      (logoUrl.includes('?') ? logoUrl : `${logoUrl}?t=${Date.now()}`) : 
      `/logo/logo.png?t=${Date.now()}`;
    setCurrentSrc(url);
  }, [logoUrl]);

  const handleError = () => {
    console.error("LogoDisplay: Failed to load logo from:", currentSrc);
    setImageError(true);
    setCurrentSrc(`/logo/logo.png?t=${Date.now()}`);
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