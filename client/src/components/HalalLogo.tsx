import { cn } from "@/lib/utils";

interface HalalLogoProps {
  className?: string;
}

export function HalalLogo({ className }: HalalLogoProps) {
  return (
    <div className={cn("fixed top-20 right-4 z-50", className)}>
      <a target="_blank" rel="noopener noreferrer">
        <img
          src="/logo/halal.png"
          alt="Halal Certification"
          className="w-[100px] h-[100px] object-contain"
        />
      </a>
    </div>
  );
}
