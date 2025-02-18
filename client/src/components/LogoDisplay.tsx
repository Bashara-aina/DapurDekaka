import { cn } from "@/lib/utils";
import { useState } from "react";

interface LogoDisplayProps {
  className?: string;
  logoUrl?: string;
}

export function LogoDisplay({ className, logoUrl }: LogoDisplayProps) {
  const [imageError, setImageError] = useState(false);

  // Reset error state when logoUrl changes
  const handleError = () => {
    console.error("Failed to load logo from:", logoUrl);
    setImageError(true);
  };

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <img 
        src={imageError ? "/logo/logo.png" : (logoUrl || "/logo/logo.png")}
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