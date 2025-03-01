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
    
    // Always strip any existing timestamp parameter
    const baseUrl = logoUrl ? logoUrl.split('?')[0] : '/logo/logo.png';
    
    // Add a new timestamp for aggressive cache busting
    const url = `${baseUrl}?t=${Date.now()}`;
    console.log("LogoDisplay: Setting image src to:", url);
    
    setCurrentSrc(url);
  }, [logoUrl]);

  const handleError = () => {
    console.error("LogoDisplay: Failed to load logo from:", currentSrc);
    setImageError(true);
    
    // Try fallback with cache busting
    setCurrentSrc(`/logo/logo.png?t=${Date.now()}`);
    
    // Log detailed error for debugging
    fetch(currentSrc.split('?')[0], { method: 'HEAD' })
      .then(res => console.log("LogoDisplay: Logo file exists check:", res.status))
      .catch(err => console.error("LogoDisplay: Logo file check failed:", err));
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