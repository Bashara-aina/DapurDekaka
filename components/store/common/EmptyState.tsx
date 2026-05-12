'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

interface EmptyStateProps {
  variant?: 'cart' | 'search' | 'orders' | 'error' | 'surprised' | 'blog';
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

function SadDimsumBowl({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('w-32 h-32', className)}
      aria-hidden="true"
    >
      {/* Bowl */}
      <ellipse cx="60" cy="75" rx="50" ry="15" fill="#E8DFC8" />
      <path
        d="M10 65 C10 45, 60 30, 60 30 C60 30, 110 45, 110 65"
        fill="#F0EAD6"
        stroke="#C9A84C"
        strokeWidth="2"
      />
      <ellipse cx="60" cy="65" rx="40" ry="10" fill="#E8DFC8" />

      {/* Sad face - dimsum */}
      <circle cx="60" cy="55" r="20" fill="#FFF8E8" />
      <circle cx="60" cy="55" r="18" fill="#F5E6C8" />

      {/* Sad eyes */}
      <ellipse cx="52" cy="50" rx="3" ry="4" fill="#4A4A4A" />
      <ellipse cx="68" cy="50" rx="3" ry="4" fill="#4A4A4A" />

      {/* Sad mouth */}
      <path
        d="M50 62 Q60 55, 70 62"
        stroke="#4A4A4A"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Steam lines (sad) */}
      <path d="M40 35 Q38 30, 40 25" stroke="#8A8A8A" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <path d="M60 32 Q58 27, 60 22" stroke="#8A8A8A" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <path d="M80 35 Q82 30, 80 25" stroke="#8A8A8A" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

const animationVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 200,
      damping: 20,
    },
  },
};

export function EmptyState({
  variant = 'cart',
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const shouldShowSadDimsum = ['cart', 'orders', 'search', 'blog'].includes(variant);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={animationVariants}
      className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}
    >
      {shouldShowSadDimsum ? (
        <motion.div
          initial={{ rotate: -5 }}
          animate={{ rotate: 5 }}
          transition={{
            repeat: Infinity,
            repeatType: 'reverse' as const,
            duration: 1.5,
            ease: 'easeInOut',
          }}
        >
          <SadDimsumBowl />
        </motion.div>
      ) : (
        <div className="text-6xl mb-4">😢</div>
      )}
      <h3 className="font-display text-xl font-semibold text-text-primary mb-2">{title}</h3>
      {description && (
        <p className="text-text-secondary mb-6 max-w-sm">{description}</p>
      )}
      {action && (
        <a
          href={action.href}
          onClick={action.onClick}
          className="inline-flex items-center justify-center h-12 px-6 bg-brand-red text-white font-semibold rounded-button shadow-button hover:shadow-button-hover transition-shadow"
        >
          {action.label}
        </a>
      )}
    </motion.div>
  );
}