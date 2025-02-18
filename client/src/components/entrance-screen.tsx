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

export default function EntranceSection() {
  const [loadedImages, setLoadedImages] = useState<string[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const { data: pageData } = useQuery({
    queryKey: queryKeys.homepage,
    queryFn: async () => {
      const response = await fetch('/api/pages/homepage', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('Failed to fetch homepage data');
      const data = await response.json();
      console.log('Fetched homepage data:', data); // Debug log
      return data;
    },
    refetchInterval: 1000, // Refetch every second during development
    staleTime: 0, // Consider data always stale
  });

  // Use the API images if available, otherwise fall back to default
  const assetImages = pageData?.carousel?.images || Array.from({ length: 33 }, (_, i) => `/asset/${i + 1}.jpg`);
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

  const title = pageData?.content?.carousel?.title || "Dapur Dekaka";
  const subtitle = pageData?.content?.carousel?.subtitle || "Nikmati Sensasi Dimsum Premium dengan Cita Rasa Autentik!";

  console.log('Using title:', title);
  console.log('Using subtitle:', subtitle);
  console.log('Homepage data:', pageData);
  console.log('Logo path:', pageData?.logo);

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
              <LogoDisplay className="mb-8" logoUrl={pageData?.logo} />
              <h1 className="text-4xl md:text-6xl font-bold mb-4 max-w-4xl">
                {title}
              </h1>
              <p className="text-xl md:text-2xl mb-8 max-w-2xl">
                {subtitle}
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