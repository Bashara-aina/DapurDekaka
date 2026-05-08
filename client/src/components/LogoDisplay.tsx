import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface LogoDisplayProps {
  className?: string;
  logoUrl?: string;
}

const DEFAULT_LOGO = "/logo/logo.png";

/** Stable asset version for cache-busting. Only changes when logo is replaced by admin. */
let assetVersion = 1;

export function bumpAssetVersion() {
  assetVersion++;
}

export function getAssetVersion(): number {
  return assetVersion;
}

/**
 * Builds a versioned image URL for stable CDN caching.
 * Only appends version param once, not on every render.
 */
function withVersionParam(original: string): string {
  const trimmed = original.trim();
  const qIndex = trimmed.indexOf("?");
  const base = qIndex === -1 ? trimmed : trimmed.slice(0, qIndex);
  return `${base}?v=${assetVersion}`;
}

/** Hero logo from CMS with stable versioning for CDN cache. */
export function LogoDisplay({ className, logoUrl }: LogoDisplayProps) {
  const [currentSrc, setCurrentSrc] = useState<string>(() =>
    logoUrl?.trim() ? withVersionParam(logoUrl) : DEFAULT_LOGO,
  );

  useEffect(() => {
    const base = logoUrl?.trim() ? logoUrl.split("?")[0] : DEFAULT_LOGO;
    setCurrentSrc(withVersionParam(base));
  }, [logoUrl]);

  const handleError = (): void => {
    setCurrentSrc(withVersionParam(DEFAULT_LOGO));
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
