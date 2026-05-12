'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dsnhwfuxh';
const CLOUDINARY_BASE = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_webp,q_auto,w_1600`;

interface Slide {
  id: number;
  cloudinaryPublicId: string;
  title: string;
  subtitle: string;
  cta?: string;
  ctaHref?: string;
}

const slides: Slide[] = [
  {
    id: 1,
    cloudinaryPublicId: 'dapurdekaka/gallery/gallery-01',
    title: 'Cita Rasa Warisan,\nKini di Rumahmu',
    subtitle: 'Dimsum, siomay, dan bakso frozen premium dari Bandung — langsung ke pintu rumah Anda',
    cta: 'Lihat Produk',
    ctaHref: '/products',
  },
  {
    id: 2,
    cloudinaryPublicId: 'dapurdekaka/gallery/gallery-02',
    title: 'Promo 10% Off',
    subtitle: 'Untuk pembelian pertama kamu dengan kode SELAMATDATANG',
    cta: 'Klaim Sekarang',
    ctaHref: '/products',
  },
  {
    id: 3,
    cloudinaryPublicId: 'dapurdekaka/gallery/gallery-03',
    title: '100% Halal & Frozen Fresh',
    subtitle: 'Kualitas terjaga sampai tujuan — dikirim ke seluruh Indonesia',
    cta: 'Pelajari Lebih Lanjut',
    ctaHref: '/blog',
  },
];

export function HeroCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  }, []);

  useEffect(() => {
    const timer = setInterval(nextSlide, 5000);
    return () => clearInterval(timer);
  }, [nextSlide]);

  const goToSlide = (index: number) => setCurrentSlide(index);
  const activeSlide = slides[currentSlide]!;
  const imageUrl = `${CLOUDINARY_BASE}/${activeSlide.cloudinaryPublicId}`;

  return (
    <section className="relative h-[50vh] md:h-[70vh] bg-brand-red overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7 }}
          className="absolute inset-0"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent z-10" />
          <Image
            src={imageUrl}
            alt={activeSlide.title}
            fill
            className="object-cover"
            priority={currentSlide === 0}
            sizes="100vw"
          />
          <div className="relative z-20 h-full flex flex-col items-center justify-center text-center px-6">
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="font-display text-3xl md:text-6xl font-bold text-white mb-3 whitespace-pre-line"
            >
              {activeSlide.title}
            </motion.h1>
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-white/90 text-base md:text-lg mb-6 max-w-xl"
            >
              {activeSlide.subtitle}
            </motion.p>
            {activeSlide.cta && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                <Link
                  href={activeSlide.ctaHref || '/products'}
                  className="inline-flex items-center h-12 px-6 bg-white text-brand-red font-bold rounded-button shadow-lg hover:bg-brand-cream transition-colors"
                >
                  {activeSlide.cta}
                </Link>
              </motion.div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Dot indicators */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              index === currentSlide
                ? 'bg-white w-8'
                : 'bg-white/50 hover:bg-white/70'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
}