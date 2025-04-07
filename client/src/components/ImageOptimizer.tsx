import { useState, useEffect, useRef } from "react";

interface ImageOptimizerProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  quality?: number;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  blur?: boolean;
  sizes?: string;
}

// Limit cache size to prevent memory issues
const MAX_CACHE_SIZE = 50;
const imageCache = new Map<string, string>();

/**
 * Clear oldest cache entries when cache exceeds maximum size
 */
function trimCache() {
  if (imageCache.size > MAX_CACHE_SIZE) {
    // Remove oldest entries (first 10 entries)
    const keysToDelete = Array.from(imageCache.keys()).slice(0, 10);
    keysToDelete.forEach(key => imageCache.delete(key));
  }
}

export function ImageOptimizer({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  quality = 80,
  objectFit = 'cover',
  blur = true,
  sizes = '',
}: ImageOptimizerProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [imageSrc, setImageSrc] = useState('');
  const [isVisible, setIsVisible] = useState(priority);
  const imgRef = useRef<HTMLDivElement>(null);
  
  // Create a cache key based on src, width, and quality
  const cacheKey = width ? `${src}?w=${width}&q=${quality}` : src;

  // Set up intersection observer for lazy loading
  useEffect(() => {
    if (priority) return; // Skip if image has priority
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Disconnect after becoming visible
          if (imgRef.current) observer.unobserve(imgRef.current);
        }
      },
      {
        // Start loading image slightly before it becomes visible
        rootMargin: '200px',
        threshold: 0.01
      }
    );
    
    if (imgRef.current) {
      observer.observe(imgRef.current);
    }
    
    return () => {
      if (imgRef.current) observer.unobserve(imgRef.current);
    };
  }, [priority]);

  // Load the image once visible or when it has priority
  useEffect(() => {
    if (!src || !isVisible) return;
    
    // Check if image is already in cache
    if (imageCache.has(cacheKey)) {
      setIsLoaded(true);
      setImageSrc(imageCache.get(cacheKey) || '');
      return;
    }

    let isMounted = true;
    const img = new Image();
    
    // Create optimized URL with width and quality parameters
    let optimizedSrc = src;
    if (width) {
      optimizedSrc += `?w=${width}`;
      if (quality < 100) {
        optimizedSrc += `&q=${quality}`;
      }
    }
    
    // Set loading attribute based on priority
    img.loading = priority ? 'eager' : 'lazy';
    
    // Set fetchPriority if supported by browser
    if ('fetchPriority' in HTMLImageElement.prototype) {
      // Using type assertion to avoid TypeScript errors
      (img as any).fetchPriority = priority ? 'high' : 'auto';
    }
    
    img.onload = () => {
      if (isMounted) {
        // Cache the successful load
        imageCache.set(cacheKey, optimizedSrc);
        trimCache(); // Manage cache size
        setIsLoaded(true);
        setImageSrc(optimizedSrc);
      }
    };

    img.onerror = () => {
      if (isMounted) {
        console.error(`Failed to load image: ${src}`);
        setIsLoaded(true);
        // Try again with original URL as fallback
        if (optimizedSrc !== src) {
          setImageSrc(src);
        }
      }
    };

    img.src = optimizedSrc;

    return () => {
      isMounted = false;
      img.onload = null;
      img.onerror = null;
    };
  }, [src, width, quality, priority, cacheKey, isVisible]);

  // Calculate the aspect ratio style if both width and height are provided
  const aspectRatioStyle = (width && height) 
    ? { aspectRatio: `${width} / ${height}` } 
    : {};
  
  // Determine object fit style
  const objectFitStyle = { objectFit };

  return (
    <div 
      ref={imgRef}
      className={`relative ${className}`} 
      style={{ width, height, ...aspectRatioStyle }}
    >
      {/* Show placeholder/blur when not loaded */}
      {(!isLoaded && blur) && (
        <div 
          className="absolute inset-0 bg-gray-200 animate-pulse rounded"
          aria-hidden="true"
        ></div>
      )}
      
      {/* Render image if source is available */}
      {(isVisible || priority) && (
        <img
          src={imageSrc || src}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          className={`
            w-full h-full 
            ${isLoaded ? 'opacity-100' : 'opacity-0'} 
            transition-opacity duration-300
          `}
          style={objectFitStyle}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          {...(priority ? { fetchPriority: "high" } : {})}
          onLoad={() => setIsLoaded(true)}
        />
      )}
    </div>
  );
}