import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";

// Asset paths array
const assetImages = Array.from({ length: 33 }, (_, i) => `/asset/${i + 1}.jpg`);
const MINIMUM_IMAGES_TO_START = 3;

export default function EntranceScreen() {
  const [, setLocation] = useLocation();
  const [isExiting, setIsExiting] = useState(false);
  const [loadedImages, setLoadedImages] = useState<string[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Enhanced preloading with progressive loading
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

    // Load first few images immediately
    const initialLoad = async () => {
      const initialImages = assetImages.slice(0, MINIMUM_IMAGES_TO_START);
      await Promise.all(initialImages.map(loadImage));

      // Then load the rest in the background
      if (mounted) {
        const remainingImages = assetImages.slice(MINIMUM_IMAGES_TO_START);
        remainingImages.forEach(loadImage); // Don't await these
      }
    };

    initialLoad();

    return () => {
      mounted = false;
    };
  }, []);

  const handleEnterSite = () => {
    setIsExiting(true);
    setTimeout(() => {
      setLocation("/home");
    }, 1000);
  };

  const autoplayOptions = {
    delay: 1000, // 1 second interval
    stopOnInteraction: false,
    stopOnMouseEnter: false,
    rootNode: (emblaRoot: any) => emblaRoot.parentElement,
  };

  const shouldShowCarousel = loadedImages.length >= MINIMUM_IMAGES_TO_START;

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black"
        >
          {/* Loading indicator */}
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
            <div className="relative h-screen overflow-hidden">
              {/* Background Carousel */}
              <div className="absolute inset-0">
                <Carousel
                  opts={{
                    align: "start",
                    loop: true,
                    dragFree: true,
                    containScroll: false,
                    duration: 500, // 0.5 seconds transition speed
                  }}
                  plugins={[Autoplay(autoplayOptions) as any]}
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
                            loading="eager"
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                </Carousel>
              </div>

              {/* Overlay Content */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="relative z-10 h-full flex flex-col items-center justify-center text-white text-center px-4"
              >
                <h1 className="text-4xl md:text-6xl font-bold mb-4 max-w-4xl">
                  Innovating Indonesia's Future with Cutting-Edge Technology
                </h1>
                <p className="text-xl md:text-2xl mb-8 max-w-2xl">
                  Leading provider of power systems, digital transformation, and defense solutions.
                </p>
                <Button
                  size="lg"
                  onClick={handleEnterSite}
                  className="text-lg px-8 py-6"
                >
                  Masuk ke Perjalanan Kami
                </Button>
              </motion.div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}