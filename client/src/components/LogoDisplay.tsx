import { cn } from "@/lib/utils";

interface LogoDisplayProps {
  className?: string;
}

export function LogoDisplay({ className }: LogoDisplayProps) {
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <img 
        src="/logo/logo.png" 
        alt="Dekaka Logo" 
        className="w-[200px] h-[200px] object-contain"
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