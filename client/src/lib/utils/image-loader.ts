
/**
 * Utilities for image optimization and loading
 */

/**
 * Generate an optimized image URL with width and quality parameters
 * @param src The original image URL
 * @param width Optional width to resize the image
 * @param quality Optional quality parameter (1-100)
 * @returns Optimized image URL
 */
export function getOptimizedImageUrl(src: string, width?: number, quality?: number): string {
  // Don't modify already optimized URLs or external URLs
  if (!src || src.includes('?') || src.startsWith('http')) return src;
  
  let optimizedUrl = src;
  const params = new URLSearchParams();
  
  if (width) params.append('w', width.toString());
  if (quality) params.append('q', quality.toString());
  
  const queryString = params.toString();
  if (queryString) {
    optimizedUrl = `${src}?${queryString}`;
  }
  
  return optimizedUrl;
}

/**
 * Preload important images to improve initial load time
 * @param urls Array of image URLs to preload
 * @param maxConcurrent Maximum number of concurrent loading images
 */
export function preloadImages(urls: string[], maxConcurrent: number = 3): void {
  if (!urls.length) return;
  
  let index = 0;
  const loadNext = () => {
    if (index >= urls.length) return;
    
    const img = new Image();
    const currentIndex = index++;
    
    img.onload = img.onerror = () => {
      loadNext();
    };
    
    img.src = urls[currentIndex];
  };
  
  // Start initial batch of concurrent loads
  for (let i = 0; i < maxConcurrent && i < urls.length; i++) {
    loadNext();
  }
}

/**
 * Generate a blurry placeholder image URL
 * This is a simple implementation - for better results,
 * consider implementing server-side processing
 * @param src The original image URL
 * @returns URL for a tiny version of the image
 */
export function getPlaceholderUrl(src: string): string {
  if (!src || src.includes('?') || src.startsWith('http')) return src;
  return `${src}?w=20&q=30`;
}

/**
 * Setup a global IntersectionObserver for lazy-loading images
 * Call this once from your main app component
 */
export function setupLazyLoadObserver(): void {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
  
  const options = {
    rootMargin: '200px', // Start loading when within 200px of viewport
    threshold: 0.01
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          observer.unobserve(img);
        }
      }
    });
  }, options);
  
  // Start observing any images with data-src attribute
  document.querySelectorAll('img[data-src]').forEach(img => {
    observer.observe(img);
  });
}
