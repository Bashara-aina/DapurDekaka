/**
 * Utility functions for image loading and optimization
 */

/**
 * Generate an optimized image URL with width and quality parameters
 * @param src The original image URL
 * @param width Requested width
 * @param quality Requested quality (1-100)
 * @returns URL for the optimized image
 */
export function getOptimizedImageUrl(src: string, width: number = 800, quality: number = 75): string {
  if (!src) return '';

  // Don't modify external URLs or already optimized URLs
  if (src.startsWith('http') || src.includes('?')) return src;

  // Apply optimization parameters
  return `${src}?w=${width}&q=${quality}`;
}

/**
 * Preload important images to improve initial load time
 * @param urls Array of image URLs to preload
 * @param maxConcurrent Maximum number of concurrent loading images
 */
export function preloadImages(urls: string[], maxConcurrent: number = 3): Promise<void[]> {
  if (!urls.length) return Promise.resolve([]);

  // Create a queue for loading images
  const queue = [...urls];
  const inProgress = new Set<string>();
  const results: Promise<void>[] = [];

  // Function to load next image in queue
  const loadNext = () => {
    if (queue.length === 0 || inProgress.size >= maxConcurrent) return;

    const url = queue.shift()!;
    inProgress.add(url);

    const promise = new Promise<void>((resolve) => {
      const img = new Image();

      img.onload = img.onerror = () => {
        inProgress.delete(url);
        resolve();
        // Try to load next image
        setTimeout(loadNext, 0);
      };

      // Start loading the image
      img.src = url;
    });

    results.push(promise);

    // Try to load more if we can
    setTimeout(loadNext, 0);
  };

  // Start initial batch of concurrent loads
  for (let i = 0; i < maxConcurrent && i < urls.length; i++) {
    loadNext();
  }

  return Promise.all(results);
}

/**
 * Generate a blurry placeholder image URL
 * @param src The original image URL
 * @returns URL for a tiny version of the image
 */
export function getPlaceholderUrl(src: string): string {
  if (!src || src.includes('?') || src.startsWith('http')) return src;
  return `${src}?w=20&q=30`;
}

/**
 * Returns an appropriate image size based on screen width
 * for responsive image loading
 */
export function getResponsiveImageSize(): number {
  if (typeof window === 'undefined') return 1200; // Default for SSR

  const width = window.innerWidth;

  if (width <= 640) return 640;      // Mobile
  if (width <= 768) return 768;      // Tablet
  if (width <= 1024) return 1024;    // Small laptop
  if (width <= 1536) return 1536;    // Large laptop/desktop
  return 1920;                       // 4K+ displays
}

/**
 * Returns a placeholder image for lazy loading
 */
export function getPlaceholderImage(): string {
  return 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
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
/**
 * Image loading utilities
 */

/**
 * Preloads an image by creating a new Image object
 * Returns a promise that resolves when the image is loaded
 */
export function preloadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Determines appropriate image size based on viewport
 */
export function getResponsiveImageSize2(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number = window.innerWidth
): { width: number; height: number } {
  if (originalWidth <= maxWidth) {
    return { width: originalWidth, height: originalHeight };
  }

  const ratio = originalHeight / originalWidth;
  const width = Math.min(maxWidth, originalWidth);
  const height = Math.round(width * ratio);

  return { width, height };
}

/**
 * Progressive image loading strategy - loads low quality placeholder first
 */
export async function loadProgressiveImage(
  src: string,
  onProgress?: (stage: 'placeholder' | 'full', img?: HTMLImageElement) => void
): Promise<HTMLImageElement> {
  // First load low quality placeholder (if available)
  if (onProgress) onProgress('placeholder');

  // Then load full quality image
  const fullImage = await preloadImage(src);
  if (onProgress) onProgress('full', fullImage);

  return fullImage;
}