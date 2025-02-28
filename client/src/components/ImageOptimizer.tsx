
import { useState, useEffect } from 'react';

interface ImageOptimizerProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}

export function ImageOptimizer({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
}: ImageOptimizerProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [imageSrc, setImageSrc] = useState('');

  useEffect(() => {
    // Don't start loading until component is mounted
    const img = new Image();
    img.onload = () => {
      setIsLoaded(true);
      setImageSrc(src);
    };
    img.onerror = () => {
      console.error(`Failed to load image: ${src}`);
      // Optionally set a fallback image
    };
    
    // Create optimized URL with width parameter if applicable
    const optimizedSrc = width ? `${src}?w=${width}` : src;
    img.src = optimizedSrc;
    
    return () => {
      // Clean up by removing event listeners
      img.onload = null;
      img.onerror = null;
    };
  }, [src, width]);

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse"></div>
      )}
      {imageSrc && (
        <img
          src={imageSrc}
          alt={alt}
          width={width}
          height={height}
          className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
        />
      )}
    </div>
  );
}
