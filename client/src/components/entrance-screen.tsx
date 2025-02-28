
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { Link } from "wouter";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { LogoDisplay } from "./LogoDisplay";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { preloadImages } from "@/lib/utils/image-loader";

// Placeholder image for failed loads
const FALLBACK_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100%25' height='100%25' fill='%23f0f0f0'/%3E%3C/svg%3E";

export default function EntranceSection() {
  const [loadedImages, setLoadedImages] = useState<string[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [shouldShowCarousel, setShouldShowCarousel] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const { t } = useLanguage();

  // Carousel setup
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [Autoplay()]);

  // Get homepage data
  const { data: pageData, isLoading } = useQuery({
    queryKey: [queryKeys.pages.home],
    queryFn: async () => {
      const response = await fetch('/api/pages/home');
      if (!response.ok) {
        throw new Error('Failed to fetch homepage data');
      }
      const data = await response.json();
      console.log('Homepage data:', data);
      return data;
    },
    staleTime: 60000, // Cache for 1 minute to prevent excessive refetching
  });

  // Preload just the first few images immediately
  useEffect(() => {
    if (pageData?.carousel?.images && pageData.carousel.images.length > 0) {
      // Preload only the first 3 images initially to improve page load time
      const imagesToPreload = pageData.carousel.images.slice(0, 3);
      preloadImages(imagesToPreload, 2);

      // Show carousel after a short delay even if not all images are loaded
      const timer = setTimeout(() => {
        setShouldShowCarousel(true);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [pageData]);

  // Track loaded images
  const handleImageLoad = (imageSrc: string) => {
    setLoadedImages(prev => {
      if (prev.includes(imageSrc)) return prev;
      
      const newLoadedImages = [...prev, imageSrc];
      
      if (pageData?.carousel?.images) {
        // Calculate progress based on loaded vs total images
        const progress = (newLoadedImages.length / pageData.carousel.images.length) * 100;
        setLoadingProgress(Math.min(progress, 100));
      }
      
      return newLoadedImages;
    });
  };

  // Setup lazy loading with intersection observer
  useEffect(() => {
    if (shouldShowCarousel && document) {
      const options = {
        rootMargin: '200px', // Start loading before images are visible
        threshold: 0.1
      };

      // Disconnect any existing observer
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      // Create new observer
      observerRef.current = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            const dataSrc = img.getAttribute('data-src');
            
            if (dataSrc) {
              img.src = dataSrc;
              img.classList.add('loaded');
              img.removeAttribute('data-src');
              observerRef.current?.unobserve(img);
            }
          }
        });
      }, options);

      // Observe all lazy images
      const lazyImages = document.querySelectorAll('img[data-src]');
      lazyImages.forEach(img => observerRef.current?.observe(img));

      // Cleanup function
      return () => {
        if (observerRef.current) {
          observerRef.current.disconnect();
        }
      };
    }
  }, [shouldShowCarousel, pageData]);

  // Handle image loading error
  const handleImageError = (imageSrc: string, e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error('Failed to load image:', imageSrc);
    
    // Set a fallback image
    const img = e.target as HTMLImageElement;
    if (img && img.src !== FALLBACK_IMAGE) {
      img.src = FALLBACK_IMAGE;
    }
    
    // Still count as "loaded" to avoid getting stuck
    handleImageLoad(imageSrc);
  };

  return (
    <main className="relative h-screen overflow-hidden">
      <AnimatePresence>
        {!shouldShowCarousel && (
          <motion.div
            className="absolute inset-0 z-30 flex items-center justify-center bg-black"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center text-white">
              <LogoDisplay size="large" />
              <div className="mt-8 w-64 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
              <p className="mt-2 text-sm">{Math.round(loadingProgress)}%</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Carousel */}
      {pageData?.carousel?.images && (
        <div className="embla overflow-hidden h-full" ref={emblaRef}>
          <div className="embla__container h-full flex">
            {pageData.carousel.images.map((image: string, index: number) => (
              <motion.div
                key={index}
                className="embla__slide relative h-full w-full flex-[0_0_100%]"
                initial={{ opacity: 0 }}
                animate={{ opacity: shouldShowCarousel ? 1 : 0 }}
                transition={{ duration: 1 }}
              >
                {index < 5 ? (
                  // Load first 5 images normally
                  <img
                    src={image}
                    alt={`Carousel image ${index + 1}`}
                    className="w-full h-full object-cover"
                    onLoad={() => handleImageLoad(image)}
                    onError={(e) => handleImageError(image, e)}
                  />
                ) : (
                  // Lazy load remaining images
                  <img
                    data-src={image}
                    src={FALLBACK_IMAGE}
                    alt={`Carousel image ${index + 1}`}
                    className="w-full h-full object-cover lazy-load"
                    onLoad={() => handleImageLoad(image)}
                    onError={(e) => handleImageError(image, e)}
                  />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Overlay content */}
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4">
        <LogoDisplay size="large" />
        {pageData?.content?.carousel && (
          <div className="mt-8 text-center text-white max-w-lg mx-auto">
            <motion.h1
              className="text-4xl font-bold"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              {pageData.content.carousel.title}
            </motion.h1>
            <motion.p
              className="mt-4 text-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
            >
              {pageData.content.carousel.subtitle}
            </motion.p>
            <motion.div
              className="mt-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.8 }}
            >
              <Link href="/menu">
                <Button variant="outline" size="lg" className="bg-white/20 hover:bg-white/30 backdrop-blur-sm">
                  {t('common.menu')}
                </Button>
              </Link>
            </motion.div>
          </div>
        )}
      </div>
    </main>
  );
}
