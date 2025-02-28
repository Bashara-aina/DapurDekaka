
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
import React, { useState, useEffect } from 'react';

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
  const [isIntersecting, setIsIntersecting] = useState(priority);
  const imgRef = React.useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (priority || !imgRef.current) return; // Skip if priority or no ref

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsIntersecting(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '200px 0px',
        threshold: 0.01,
      }
    );

    observer.observe(imgRef.current);

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, [priority]);

  // Generate optimized image URL with width/height parameters if provided
  const optimizedSrc = () => {
    if (!src) return '';
    
    // For demonstration, this is a simple approach
    // In a production app, you would integrate with an image optimization service
    const url = new URL(src, window.location.origin);
    
    if (width) url.searchParams.append('w', width.toString());
    if (height) url.searchParams.append('h', height.toString());
    
    return url.toString();
  };

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ aspectRatio: width && height ? width/height : 'auto' }}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse"></div>
      )}
      
      <img
        ref={imgRef}
        src={isIntersecting ? optimizedSrc() : ''}
        data-src={src}
        alt={alt}
        width={width}
        height={height}
        onLoad={() => setIsLoaded(true)}
        className={`transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${className}`}
      />
    </div>
  );
}

export default ImageOptimizer;
import { useState, useEffect, useRef } from 'react';
import { getOptimizedImageUrl, getResponsiveImageSize } from '@/lib/utils/image-loader';

interface ImageOptimizerProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  quality?: number;
  lazyLoad?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

export default function ImageOptimizer({
  src,
  alt,
  width,
  height,
  className = '',
  quality = 75,
  lazyLoad = true,
  onLoad,
  onError
}: ImageOptimizerProps) {
  const [loaded, setLoaded] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>('');
  const imageRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  
  // Generate responsive image URL
  useEffect(() => {
    // Use screen size-based width if not provided
    const responsiveWidth = width || getResponsiveImageSize();
    setImageSrc(getOptimizedImageUrl(src, responsiveWidth, quality));
  }, [src, width, quality]);
  
  // Setup intersection observer for lazy loading
  useEffect(() => {
    if (!lazyLoad || !imageRef.current) return;
    
    const options = {
      rootMargin: '200px',
      threshold: 0.1
    };
    
    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && imageRef.current) {
          // Set actual source
          if (imageRef.current.src !== imageSrc) {
            imageRef.current.src = imageSrc;
          }
          
          // Cleanup
          if (observerRef.current) {
            observerRef.current.unobserve(entry.target);
            observerRef.current.disconnect();
          }
        }
      });
    };
    
    observerRef.current = new IntersectionObserver(handleIntersection, options);
    observerRef.current.observe(imageRef.current);
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [lazyLoad, imageSrc]);
  
  const handleImageLoad = () => {
    setLoaded(true);
    if (onLoad) onLoad();
  };
  
  const handleImageError = () => {
    if (onError) onError();
    // Use a placeholder image on error
    if (imageRef.current) {
      imageRef.current.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100%25' height='100%25' fill='%23f0f0f0'/%3E%3C/svg%3E";
    }
  };
  
  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {!loaded && (
        <div 
          className="absolute inset-0 bg-gray-200 animate-pulse" 
          style={{ width, height }}
        />
      )}
      
      <img
        ref={imageRef}
        src={lazyLoad ? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100%25' height='100%25' fill='%23f0f0f0'/%3E%3C/svg%3E" : imageSrc}
        alt={alt}
        width={width}
        height={height}
        className={`transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
        loading={lazyLoad ? "lazy" : "eager"}
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
    </div>
  );
}
