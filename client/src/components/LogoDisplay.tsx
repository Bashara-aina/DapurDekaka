import { cn } from "@/lib/utils";

interface LogoDisplayProps {
  className?: string;
}

export function LogoDisplay({ className }: LogoDisplayProps) {
  return (
    <div className={cn("flex flex-col items-center gap-6", className)}>
      {/* Logo image - 2x size of halal logo */}
      <img 
        src="/logo/logo.png" 
        alt="Dekaka Logo" 
        className="w-[200px] h-[200px] object-contain"
      />
      
      {/* Halal logo - smaller size */}
      <img 
        src="/logo/halal.png" 
        alt="Halal Certification" 
        className="w-[100px] h-[100px] object-contain"
      />
    </div>
  );
}
