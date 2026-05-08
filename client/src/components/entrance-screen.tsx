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

const FALLBACK_IMAGES: string[] = [];

export default function EntranceSection() {
  const { t } = useLanguage();
  const preloadRunRef = useRef(0);

  const [carouselImages, setCarouselImages] = useState<string[]>(FALLBACK_IMAGES);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [carouselTitle, setCarouselTitle] = useState<string>("");
  const [carouselSubtitle, setCarouselSubtitle] = useState<string>("");
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  const { data: pageData } = useQuery({
    queryKey: ["pages", "homepage"],
    queryFn: async () => {
      const response = await fetch(`/api/pages/homepage`);
      if (!response.ok) throw new Error("Failed to fetch homepage data");
      return response.json();
    },
    refetchInterval: false,
    staleTime: 300000,
    gcTime: 600000,
    refetchOnWindowFocus: false,
  });

  // Sync API data into state when it arrives
  useEffect(() => {
    if (pageData) {
      if (pageData.carousel?.images) {
        setCarouselImages(pageData.carousel.images);
      }
      if (pageData.logo) setLogoUrl(pageData.logo);
      if (pageData.carousel?.title || pageData.content?.hero?.title) {
        setCarouselTitle(pageData.carousel?.title || pageData.content?.hero?.title || "");
      }
      if (pageData.carousel?.subtitle || pageData.content?.hero?.subtitle) {
        setCarouselSubtitle(pageData.carousel?.subtitle || pageData.content?.hero?.subtitle || "");
      }
    }
  }, [pageData]);

  // Prefetch images silently in background — never block rendering
  useEffect(() => {
    preloadRunRef.current += 1;
    let mounted = true;
    const loadedSet = new Set<string>();

    const loadImage = (imageUrl: string) => {
      const img = new Image();
      img.src = imageUrl;
      img.onload = () => {
        if (mounted) {
          loadedSet.add(imageUrl);
          setLoadedImages(new Set(loadedSet));
        }
      };
      img.onerror = () => {
        if (mounted) {
          loadedSet.add(imageUrl);
          setLoadedImages(new Set(loadedSet));
        }
      };
    };

    // Load all images in background without waiting
    carouselImages.forEach(loadImage);

    return () => {
      mounted = false;
    };
  }, [carouselImages]);

  const autoplayOptions = {
    delay: 2000,
    stopOnInteraction: false,
    stopOnMouseEnter: false,
    rootNode: (emblaRoot: HTMLElement) => emblaRoot.parentElement as HTMLElement,
  };

  // Always show content immediately — no loading gate
  // Duplicate images for seamless looping
  const displayImages = [...carouselImages, ...carouselImages];

  // First image is always the hero — show it eagerly
  const heroImage = carouselImages[0] || "";
  const heroLoaded = loadedImages.has(heroImage) || heroImage.length === 0;

  return (
    <section className="relative h-screen overflow-hidden">
      {/* Immediate skeleton — replaced by real content as images load */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="Hero"
          className="w-full h-full object-cover"
          loading="eager"
          fetchPriority="high"
          decoding="sync"
          width="1920"
          height="1080"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-black/50" />
      </div>

      {/* Hero content — visible immediately */}
      <div className="relative z-20 h-full flex flex-col items-center justify-center text-white text-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <LogoDisplay className="mb-8" logoUrl={logoUrl} />
          <h1 className="text-4xl md:text-6xl font-bold mb-4 max-w-4xl">
            {carouselTitle || t("home.hero.title")}
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-2xl">
            {carouselSubtitle || t("home.hero.subtitle")}
          </p>
          <Button size="lg" className="text-lg px-8 py-6" asChild>
            <Link href="/menu">{t("common.viewMenu")}</Link>
          </Button>
        </motion.div>
      </div>

      {/* Carousel fades in once 5+ images are loaded */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ${
          loadedImages.size >= 5 ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <Carousel
          opts={{
            align: "center",
            loop: true,
            dragFree: true,
            containScroll: false,
            duration: 500,
          }}
          plugins={[Autoplay(autoplayOptions) as unknown as (typeof import("embla-carousel-react"))["default"] extends (...args: unknown[]) => infer R ? R : never]}
          className="h-full"
        >
          <CarouselContent className="-ml-1">
            {displayImages.map((imagePath, index) => (
              <CarouselItem key={`slide-${index}`} className="pl-1 md:basis-1/3">
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
        {/* Overlay for text legibility */}
        <div className="absolute inset-0 bg-black/50 z-10" />
      </div>
    </section>
  );
}
