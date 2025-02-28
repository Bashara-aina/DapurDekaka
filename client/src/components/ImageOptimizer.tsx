import { useState, useEffect } from 'react';

import { useState, useEffect } from "react";

interface ImageOptimizerProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}

const imageCache = new Map<string, string>();

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
  
  // Create a cache key based on src and width
  const cacheKey = width ? `${src}?w=${width}` : src;

  useEffect(() => {
    if (!src) return;
    
    // Check if image is already in cache
    if (imageCache.has(cacheKey)) {
      setIsLoaded(true);
      setImageSrc(imageCache.get(cacheKey) || '');
      return;
    }

    let isMounted = true;
    const img = new Image();
    
    // Create optimized URL with width parameter if applicable
    const optimizedSrc = width ? `${src}?w=${width}` : src;
    
    // Set loading attribute based on priority
    img.loading = priority ? 'eager' : 'lazy';
    
    // Set fetchPriority if supported
    if (priority && 'fetchPriority' in HTMLImageElement.prototype) {
      img.fetchPriority = 'high';
    }
    
    img.onload = () => {
      if (isMounted) {
        // Cache the successful load
        imageCache.set(cacheKey, optimizedSrc);
        setIsLoaded(true);
        setImageSrc(optimizedSrc);
      }
    };

    img.onerror = () => {
      if (isMounted) {
        console.error(`Failed to load image: ${src}`);
        setIsLoaded(true);
      }
    };

    img.src = optimizedSrc;

    return () => {
      isMounted = false;
      img.onload = null;
      img.onerror = null;
    };
  }, [src, width, priority, cacheKey]);

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