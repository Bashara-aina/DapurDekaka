import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
// embla-carousel-autoplay import removed during optimization
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

export default function EntranceSection() {
  const [loadedImages, setLoadedImages] = useState<string[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const { t } = useLanguage();

  const { data: pageData } = useQuery({
    queryKey: ["/api/pages/homepage"],
    queryFn: async () => {
      // Add timestamp to prevent browser caching
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/pages/homepage?t=${timestamp}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('Failed to fetch homepage data');
      const data = await response.json();
      console.log('Homepage data:', data);
      return data;
    },
    refetchInterval: 500, // More frequent refetching
    staleTime: 0, // Always consider data stale
    cacheTime: 0, // Don't cache the data
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  const assetImages = pageData?.carousel?.images || Array.from({ length: 33 }, (_, i) => `/asset/${i + 1}.jpg`);
  // Try to get title and subtitle from multiple possible locations in the data structure
  const carouselTitle = pageData?.carousel?.title || 
                        pageData?.content?.carousel?.title || 
                        pageData?.content?.hero?.title || 
                        "";
  const carouselSubtitle = pageData?.carousel?.subtitle || 
                          pageData?.content?.carousel?.subtitle || 
                          pageData?.content?.hero?.subtitle || 
                          "";
  const MINIMUM_IMAGES_TO_START = 3;

  useEffect(() => {
    let mounted = true;
    const loadedImageSet = new Set<string>();

    const loadImage = async (imageUrl: string) => {
      try {
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = imageUrl;
        });

        if (mounted) {
          loadedImageSet.add(imageUrl);
          setLoadedImages(Array.from(loadedImageSet));
          setLoadingProgress((loadedImageSet.size / assetImages.length) * 100);
        }
      } catch (error) {
        console.error(`Failed to load image: ${imageUrl}`, error);
      }
    };

    const initialLoad = async () => {
      const initialImages = assetImages.slice(0, MINIMUM_IMAGES_TO_START);
      await Promise.all(initialImages.map(loadImage));

      if (mounted) {
        const remainingImages = assetImages.slice(MINIMUM_IMAGES_TO_START);
        remainingImages.forEach(loadImage);
      }
    };

    initialLoad();

    return () => {
      mounted = false;
    };
  }, [assetImages]);

  const autoplayOptions = {
    delay: 2000,
    stopOnInteraction: false,
    stopOnMouseEnter: false,
    rootNode: (emblaRoot: any) => emblaRoot.parentElement,
  };

  const shouldShowCarousel = loadedImages.length >= MINIMUM_IMAGES_TO_START;

  useEffect(() => {
    if (!shouldShowCarousel || !pageData?.carousel?.images) {
      return;
    }

    // Use Intersection Observer API more efficiently
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            const dataSrc = img.getAttribute('data-src');
            if (dataSrc) {
              img.src = dataSrc;
              img.removeAttribute('data-src');
              observer.unobserve(img);
            }
          }
        });
      },
      { rootMargin: '200px', threshold: 0.01 }
    );

    // Observe images with a small delay to prevent blocking the main thread
    let timeout: NodeJS.Timeout;
    const observeImages = () => {
      const lazyImages = document.querySelectorAll('img[data-src]');
      lazyImages.forEach(img => observer.observe(img));
    };

    // Delay observation slightly to improve initial render performance
    timeout = setTimeout(observeImages, 100);

    return () => {
      clearTimeout(timeout);
      observer.disconnect();
    };
  }, [shouldShowCarousel, pageData]);

  return (
    <section className="relative h-screen overflow-hidden">
      {!shouldShowCarousel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-4">
          <div className="w-64 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-300 ease-out rounded-full"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
          <p className="text-sm">Loading... {Math.round(loadingProgress)}%</p>
        </div>
      )}

      {shouldShowCarousel && (
        <div className="relative h-screen">
          <div className="absolute inset-0">
            <Carousel
              opts={{
                align: "start",
                loop: true,
                dragFree: true,
                containScroll: false,
                duration: 500,
              }}
              // Autoplay is now handled by CSS animation
              className="h-full"
            >
              <CarouselContent className="-ml-1">
                {loadedImages.map((imagePath, index) => (
                  <CarouselItem key={index} className="pl-1 md:basis-1/3">
                    <div className="relative h-screen">
                      <img
                        src={imagePath}
                        alt={`Slide ${index + 1}`}
                        className="w-full h-full object-cover"
                        loading={index < 5 ? "eager" : "lazy"}
                        fetchPriority={index < 5 ? "high" : "auto"}
                        decoding="async"
                        width="800"
                        height="600"
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </div>

          <div className="absolute inset-0 bg-black/50 z-10" />
          <div className="relative z-20 h-full flex flex-col items-center justify-center text-white text-center px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <LogoDisplay className="mb-8" logoUrl={pageData?.logo} />
              <h1 className="text-4xl md:text-6xl font-bold mb-4 max-w-4xl">
                {carouselTitle || t('home.hero.title')}
              </h1>
              <p className="text-xl md:text-2xl mb-8 max-w-2xl">
                {carouselSubtitle || t('home.hero.subtitle')}
              </p>
              <Button size="lg" className="text-lg px-8 py-6" asChild>
                <Link href="/menu">{t('common.viewMenu')}</Link>
              </Button>
            </motion.div>
          </div>
        </div>
      )}
    </section>
  );
}