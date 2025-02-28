
import { useState, useEffect } from 'react';
import { getOptimizedImageUrl } from '@/lib/utils/dependency-manager';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  onLoad?: () => void;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  onLoad,
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const optimizedSrc = getOptimizedImageUrl(src, width);
  
  useEffect(() => {
    if (priority) {
      const img = new Image();
      img.src = optimizedSrc;
    }
  }, [optimizedSrc, priority]);
  
  const handleLoad = () => {
    setIsLoaded(true);
    if (onLoad) onLoad();
  };

  return (
    <img 
      src={priority ? optimizedSrc : undefined}
      data-src={!priority ? optimizedSrc : undefined}
      alt={alt}
      width={width}
      height={height}
      className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
      onLoad={handleLoad}
      loading={priority ? 'eager' : 'lazy'}
    />
  );
}
