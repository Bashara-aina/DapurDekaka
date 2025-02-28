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

  // Carousel states
  const [shouldShowCarousel, setShouldShowCarousel] = useState(false);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [Autoplay()]);

  // Get homepage data
  const { data: pageData } = useQuery({
    queryKey: [queryKeys.pages.home],
    queryFn: async () => {
      const response = await fetch('/api/pages/home');
      if (!response.ok) {
        throw new Error('Failed to fetch homepage data');
      }
      const data = await response.json();
      console.log('Homepage data:', data);
      return data;
    }
  });

  // Track loaded images
  const handleImageLoad = (imageSrc: string) => {
    if (!loadedImages.includes(imageSrc)) {
      const newLoadedImages = [...loadedImages, imageSrc];
      setLoadedImages(newLoadedImages);

      if (pageData?.carousel?.images) {
        const progress = (newLoadedImages.length / pageData.carousel.images.length) * 100;
        setLoadingProgress(Math.min(progress, 100));

        // Show carousel when all images are loaded
        if (newLoadedImages.length >= Math.min(5, pageData.carousel.images.length)) {
          setShouldShowCarousel(true);
        }
      }
    }
  };

  // Handle image loading error
  const handleImageError = (imageSrc: string, e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.log('Failed to load image:', imageSrc, e);
    // Still count failed images to avoid getting stuck on loading
    handleImageLoad(imageSrc);
  };

  // Effect for preloading images
  useEffect(() => {
    if (!shouldShowCarousel && pageData?.carousel?.images) {
      // Preload the first 5 images
      const imagesToPreload = pageData.carousel.images.slice(0, 5);

      imagesToPreload.forEach(imageSrc => {
        const img = new Image();
        img.onload = () => handleImageLoad(imageSrc);
        img.onerror = (e) => handleImageError(imageSrc, e as any);
        img.src = imageSrc;
      });
    }
  }, [pageData, shouldShowCarousel]);

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex flex-col items-center justify-center text-white">
      {/* Loading state */}
      {!shouldShowCarousel && (
        <div className="flex flex-col items-center justify-center gap-4">
          <LogoDisplay size="large" />
          <div className="w-64 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Carousel */}
      {shouldShowCarousel && (
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <div className="absolute inset-0 bg-black/50 z-10" />

          <div className="embla overflow-hidden h-full" ref={emblaRef}>
            <div className="embla__container h-full flex">
              {pageData?.carousel?.images?.map((image: string, index: number) => (
                <motion.div
                  key={index}
                  className="embla__slide relative h-full w-full flex-[0_0_100%]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1 }}
                >
                  <img
                    src={image}
                    alt={`Carousel image ${index + 1}`}
                    className="w-full h-full object-cover"
                    onLoad={() => handleImageLoad(image)}
                    onError={(e) => handleImageError(image, e)}
                  />
                </motion.div>
              ))}
            </div>
          </div>

          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4">
            <LogoDisplay size="large" />

            <motion.div
              className="mt-8 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
            >
              <h1 className="text-4xl md:text-6xl font-bold mb-4">
                {pageData?.content?.hero?.title || t('home.hero.title')}
              </h1>
              <p className="text-xl md:text-2xl mb-8">
                {pageData?.content?.hero?.subtitle || t('home.hero.subtitle')}
              </p>

              <Link href="/menu">
                <Button size="lg" className="bg-primary hover:bg-primary/80 text-white">
                  {t('home.hero.cta')}
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
}