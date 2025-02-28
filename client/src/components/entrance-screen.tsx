import { useState, useEffect } from "react";
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

export default function EntranceSection() {
  const [loadedImages, setLoadedImages] = useState<string[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const { t } = useLanguage();

  const { data: pageData } = useQuery({
    queryKey: ["/api/pages/homepage"],
    queryFn: async () => {
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
    refetchInterval: 500, 
    staleTime: 0, 
    cacheTime: 0, 
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  const assetImages = pageData?.carousel?.images || Array.from({ length: 33 }, (_, i) => `/asset/${i + 1}.jpg`);
  const carouselTitle = pageData?.carousel?.title || 
                        pageData?.content?.carousel?.title || 
                        pageData?.content?.hero?.title || 
                        "";
  const carouselSubtitle = pageData?.carousel?.subtitle || 
                          pageData?.content?.carousel?.subtitle || 
                          pageData?.content?.hero?.subtitle || 
                          "";
  const MINIMUM_IMAGES_TO_START = 3;
  const BATCH_SIZE = 5; 

  useEffect(() => {
    let mounted = true;
    let isFetching = false;
    const loadedImageSet = new Set<string>();
    const imageCache = new Map<string, string>();

    const getOptimizedImageUrl = (url: string, width: number = 800) => {
      if (url.includes('?')) return url;
      return `${url}?w=${width}&q=75`;
    };

    const loadImage = async (imageUrl: string, priority: boolean = false) => {
      if (loadedImageSet.has(imageUrl)) return;

      try {
        const optimizedUrl = getOptimizedImageUrl(imageUrl, priority ? 1200 : 800);
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = optimizedUrl;
        });

        if (mounted) {
          loadedImageSet.add(imageUrl);
          imageCache.set(imageUrl, optimizedUrl);
          setLoadedImages(Array.from(loadedImageSet));
          setLoadingProgress((loadedImageSet.size / assetImages.length) * 100);
        }
      } catch (error) {
        console.error(`Failed to load image: ${imageUrl}`, error);
      }
    };

    const loadImageBatch = async (startIndex: number, endIndex: number, priority: boolean = false) => {
      if (isFetching || !mounted) return;
      isFetching = true;

      const batch = assetImages.slice(startIndex, endIndex);
      await Promise.all(batch.map(img => loadImage(img, priority)));

      isFetching = false;

      if (mounted && loadedImageSet.size < assetImages.length && endIndex < assetImages.length) {
        setTimeout(() => {
          loadImageBatch(endIndex, endIndex + BATCH_SIZE);
        }, 300); 
      }
    };

    const initialLoad = async () => {
      const initialImages = assetImages.slice(0, MINIMUM_IMAGES_TO_START);
      await Promise.all(initialImages.map(img => loadImage(img, true)));

      if (mounted) {
        loadImageBatch(MINIMUM_IMAGES_TO_START, MINIMUM_IMAGES_TO_START + BATCH_SIZE);
      }
    };

    initialLoad();

    const setupIntersectionObserver = () => {
      if (!shouldShowCarousel || typeof window === 'undefined') return () => {}; // Return an empty function if conditions aren't met

      const options = {
        root: null,
        rootMargin: '200px', 
        threshold: 0.1
      };

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            const originalSrc = img.dataset.src;
            if (originalSrc && img.src !== originalSrc) {
              img.src = originalSrc;
              observer.unobserve(img);
            }
          }
        });
      }, options);

      document.querySelectorAll('.carousel-img[data-src]').forEach(img => {
        observer.observe(img);
      });

      return () => observer.disconnect();
    };

    useEffect(() => {
      if (!shouldShowCarousel || !pageData?.carousel?.images) {
        return;
      }

      const options = {
        rootMargin: '0px',
        threshold: 0.1
      };

      const callback = (entries: IntersectionObserverEntry[]) => {
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
      };

      const observer = new IntersectionObserver(callback, options);

      // Select all images with data-src attribute
      const lazyImages = document.querySelectorAll('img[data-src]');
      lazyImages.forEach(img => observer.observe(img));

      return () => {
        observer.disconnect();
      };
    }, [shouldShowCarousel, pageData]);

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
              plugins={[Autoplay(autoplayOptions) as any]}
              className="h-full"
            >
              <CarouselContent className="-ml-1">
                {loadedImages.map((imagePath, index) => {
                  const isPriority = index < 5;
                  const optimizedSrc = `${imagePath}?w=${isPriority ? 1200 : 800}&q=${isPriority ? 85 : 75}`;
                  const useDataSrc = index >= 10;

                  return (
                    <CarouselItem key={index} className="pl-1 md:basis-1/3">
                      <div className="relative h-screen">
                        <div className="absolute inset-0 bg-gray-200 animate-pulse"></div>
                        <img
                          src={useDataSrc ? (isPriority ? optimizedSrc : '') : optimizedSrc}
                          data-src={useDataSrc ? optimizedSrc : undefined}
                          alt={`Slide ${index + 1}`}
                          className="carousel-img w-full h-full object-cover transition-opacity duration-300"
                          loading={isPriority ? "eager" : "lazy"}
                          fetchPriority={isPriority ? "high" : "auto"}
                          decoding="async"
                          width="800"
                          height="600"
                          onLoad={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.style.opacity = "1";
                            const placeholder = img.previousElementSibling;
                            if (placeholder) {
                              placeholder.classList.add('opacity-0');
                            }
                          }}
                          style={{ opacity: 0 }}
                        />
                      </div>
                    </CarouselItem>
                  );
                })}
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