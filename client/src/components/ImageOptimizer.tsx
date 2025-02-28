
interface ImageOptimizerProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  quality?: number;
  sizes?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
}

import { useState, useEffect, useRef } from 'react';

export function ImageOptimizer({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  quality = 75,
  sizes = '100vw',
  objectFit = 'cover',
}: ImageOptimizerProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [imageSrc, setImageSrc] = useState('');
  const imgRef = useRef<HTMLImageElement>(null);
  const hasIntersectionObserver = typeof IntersectionObserver !== 'undefined';
  const placeholderRef = useRef<HTMLDivElement>(null);

  // Generate optimized URL with width and quality parameters
  const getOptimizedSrc = (url: string) => {
    // Don't modify already optimized URLs
    if (url.includes('?')) return url;
    
    let optimizedUrl = url;
    const params = new URLSearchParams();
    
    if (width) params.append('w', width.toString());
    if (quality) params.append('q', quality.toString());
    
    const queryString = params.toString();
    if (queryString) {
      optimizedUrl = `${url}?${queryString}`;
    }
    
    return optimizedUrl;
  };

  useEffect(() => {
    // Don't start loading until component is mounted
    if (!src) return;
    
    // If priority is true, load immediately without intersection observer
    if (priority) {
      const optimizedSrc = getOptimizedSrc(src);
      const img = new Image();
      img.onload = () => {
        setIsLoaded(true);
        setImageSrc(optimizedSrc);
      };
      img.onerror = () => {
        console.error(`Failed to load image: ${src}`);
        // Optionally set a fallback image
      };
      img.src = optimizedSrc;
      
      return () => {
        img.onload = null;
        img.onerror = null;
      };
    }
    
    // For non-priority images, use Intersection Observer for lazy loading
    if (hasIntersectionObserver) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const optimizedSrc = getOptimizedSrc(src);
              const img = new Image();
              img.onload = () => {
                setIsLoaded(true);
                setImageSrc(optimizedSrc);
              };
              img.onerror = () => {
                console.error(`Failed to load image: ${src}`);
              };
              img.src = optimizedSrc;
              
              // Stop observing once the element is visible
              observer.unobserve(entry.target);
            }
          });
        },
        {
          rootMargin: '200px', // Start loading when within 200px of viewport
          threshold: 0.01
        }
      );
      
      if (imgRef.current) {
        observer.observe(imgRef.current);
      }
      
      return () => {
        if (imgRef.current) {
          observer.unobserve(imgRef.current);
        }
        observer.disconnect();
      };
    } else {
      // Fallback for browsers without Intersection Observer
      const optimizedSrc = getOptimizedSrc(src);
      const img = new Image();
      img.onload = () => {
        setIsLoaded(true);
        setImageSrc(optimizedSrc);
      };
      img.src = optimizedSrc;
      
      return () => {
        img.onload = null;
      };
    }
  }, [src, width, priority, quality, hasIntersectionObserver]);

  return (
    <div 
      className={`relative ${className}`} 
      style={{ width: width ? `${width}px` : '100%', height: height ? `${height}px` : 'auto' }}
      ref={placeholderRef}
    >
      {!isLoaded && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse rounded overflow-hidden"></div>
      )}
      <img
        ref={imgRef}
        src={imageSrc || (priority ? getOptimizedSrc(src) : '')}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        sizes={sizes}
        className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
        style={{ objectFit }}
        onLoad={() => {
          if (placeholderRef.current) {
            placeholderRef.current.querySelector('div')?.classList.add('opacity-0');
          }
        }}
      />
    </div>
  );
}
