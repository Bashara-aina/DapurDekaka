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
    
    // Create a more unique timestamp with random component
    const uniqueId = `t=${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    const url = `${baseUrl}?${uniqueId}`;
    console.log("LogoDisplay: Setting image src with unique ID:", url);
    
    // Force browser to actually reload the image by:
    // 1. Setting a dummy src first
    setCurrentSrc('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
    
    // 2. Then setting the actual src after a brief delay
    setTimeout(() => {
      setCurrentSrc(url);
    }, 50);
  }, [logoUrl]);

  const handleError = () => {
    console.error("LogoDisplay: Failed to load logo from:", currentSrc);
    setImageError(true);
    
    // Try fallback with aggressive cache busting
    const fallbackUrl = `/logo/logo.png?fallback=${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    console.log("LogoDisplay: Trying fallback URL:", fallbackUrl);
    setCurrentSrc(fallbackUrl);
    
    // Attempt to diagnose the issue with detailed logging
    fetch('/logo/logo.png', { method: 'HEAD', cache: 'no-store' })
      .then(res => {
        console.log("LogoDisplay: Logo file check status:", res.status);
        console.log("LogoDisplay: Response headers:", 
          Object.fromEntries([...res.headers.entries()]));
      })
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