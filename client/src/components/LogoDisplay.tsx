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

    // Generate a completely unique URL to force reload
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 10);
    const baseUrl = logoUrl ? logoUrl.split('?')[0] : '/logo/logo.png';
    const url = `${baseUrl}?nocache=${timestamp}-${randomStr}`;

    console.log("LogoDisplay: Setting image src with unique cache buster:", url);

    // Check if the file exists before trying to load it
    fetch(baseUrl, { 
      method: 'HEAD',
      cache: 'no-store',
      headers: { 'Pragma': 'no-cache' }
    })
      .then(res => {
        console.log("LogoDisplay: Logo file check result:", {
          status: res.status,
          statusText: res.statusText,
          headers: Object.fromEntries([...res.headers.entries()])
        });

        if (res.ok) {
          // File exists, proceed with loading it
          // Force browser to completely reload the image
          setCurrentSrc('');

          // Then force a browser repaint
          document.body.offsetHeight;

          // Finally set the new source with cache busting
          setTimeout(() => {
            setCurrentSrc(url);

            // Log full image URL for debugging
            console.log("LogoDisplay: Set final image URL:", url);
          }, 100);
        } else {
          // File doesn't exist or other error
          console.error("LogoDisplay: Logo file not accessible:", baseUrl);
          setImageError(true);
          setCurrentSrc(`/logo/logo.png?fallback=${timestamp}`);
        }
      })
      .catch(err => {
        console.error("LogoDisplay: Error checking logo file:", err);
        setImageError(true);
        setCurrentSrc(`/logo/logo.png?fallback=${timestamp}`);
      });
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