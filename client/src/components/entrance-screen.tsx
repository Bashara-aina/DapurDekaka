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

const assetImages = Array.from({ length: 33 }, (_, i) => `/asset/${i + 1}.jpg`);
const MINIMUM_IMAGES_TO_START = 3;

export default function EntranceSection() {
  const [loadedImages, setLoadedImages] = useState<string[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);

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
  }, []);

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
          {/* Background Carousel */}
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

          {/* Content Overlay */}
          <div className="absolute inset-0 bg-black/50 z-10" />
          <div className="relative z-20 h-full flex flex-col items-center justify-center text-white text-center px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <LogoDisplay className="mb-8" />
              <h1 className="text-4xl md:text-6xl font-bold mb-4 max-w-4xl">
                Dapur Dekaka
              </h1>
              <p className="text-xl md:text-2xl mb-8 max-w-2xl">
                Nikmati Sensasi Dimsum Premium dengan Cita Rasa Autentik!
              </p>
              <Button size="lg" className="text-lg px-8 py-6" asChild>
                <Link href="/menu">Lihat Menu Kami</Link>
              </Button>
            </motion.div>
          </div>
        </div>
      )}
    </section>
  );
}