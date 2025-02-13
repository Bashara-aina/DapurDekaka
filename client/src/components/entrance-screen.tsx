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

export default function EntranceScreen() {
  const [, setLocation] = useLocation();
  const [isExiting, setIsExiting] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [loadedImages, setLoadedImages] = useState<string[]>([]);

  // Preload images
  useEffect(() => {
    const loadImage = (imageUrl: string) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          setLoadedImages(prev => [...prev, imageUrl]);
          resolve(imageUrl);
        };
        img.onerror = () => {
          console.error(`Failed to load image: ${imageUrl}`);
          reject(new Error(`Failed to load image: ${imageUrl}`));
        };
        img.src = imageUrl;
      });
    };

    Promise.allSettled(assetImages.map(loadImage))
      .then((results) => {
        const successfullyLoaded = results.filter(result => result.status === 'fulfilled').length;
        if (successfullyLoaded > 0) {
          setImagesLoaded(true);
        }
      })
      .catch(error => {
        console.error("Error preloading images:", error);
        // Handle the error appropriately, perhaps display a fallback message.  For now, we'll still try to render.
      });
  }, []);

  const handleEnterSite = () => {
    setIsExiting(true);
    setTimeout(() => {
      setLocation("/home");
    }, 1000);
  };

  const autoplayOptions = {
    delay: 1000, // 1 second interval as requested
    stopOnInteraction: false,
    stopOnMouseEnter: false,
    rootNode: (emblaRoot: any) => emblaRoot.parentElement,
  };

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
          {!imagesLoaded && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <p>Loading images... {loadedImages.length}/{assetImages.length}</p>
            </div>
          )}

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
                  {assetImages.map((imagePath, index) => (
                    <CarouselItem key={index} className="pl-1 md:basis-1/3">
                      <div className="relative h-screen">
                        <img
                          src={imagePath}
                          alt={`Slide ${index + 1}`}
                          className="w-full h-full object-cover"
                          loading="eager"
                          onError={(e) => {
                            console.error(`Error loading image at runtime: ${imagePath}`);
                            // Consider a fallback image here
                          }}
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}