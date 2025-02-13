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
import { assetData } from "@shared/asset-data";

export default function EntranceScreen() {
  const [, setLocation] = useLocation();
  const [isExiting, setIsExiting] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(0);
  const totalImages = assetData.length;

  // Preload images
  useEffect(() => {
    const preloadPromises = assetData.map((item) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = `/asset/${item.id}.JPG`;
        img.onload = () => {
          setImagesLoaded(prev => prev + 1);
          resolve(img);
        };
        img.onerror = (err) => {
          console.error(`Error loading image /asset/${item.id}.JPG:`, err);
          reject(err);
        };
      });
    });

    Promise.all(preloadPromises).catch(error => {
      console.error('Failed to load some images:', error);
    });
  }, []);

  const handleEnterSite = () => {
    setIsExiting(true);
    setTimeout(() => {
      setLocation("/home");
    }, 1000);
  };

  const autoplayOptions = {
    delay: 1000,
    stopOnInteraction: false,
    stopOnMouseEnter: false,
    rootNode: (emblaRoot: any) => emblaRoot.parentElement,
  };

  // Show loading screen only if no images have loaded yet
  if (imagesLoaded === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black"
        >
          <div className="relative h-screen overflow-hidden">
            {/* Background Carousel */}
            <div className="absolute inset-0">
              <Carousel
                opts={{
                  align: "start",
                  loop: true,
                  dragFree: true,
                  containScroll: false,
                }}
                plugins={[Autoplay(autoplayOptions)]}
                className="h-full"
              >
                <CarouselContent className="-ml-1">
                  {assetData.map((item, index) => (
                    <CarouselItem key={index} className="pl-1 md:basis-1/2 lg:basis-1/3">
                      <div className="relative h-screen">
                        <img
                          src={`/asset/${item.id}.JPG`}
                          alt={`Background ${item.id}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40" />
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