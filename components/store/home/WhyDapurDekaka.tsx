'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { CheckCircle, Snowflake, Truck } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const iconComponents = [CheckCircle, Snowflake, Truck];

export interface WhyFeature {
  title: string;
  description: string;
}

interface WhyDapurDekakaProps {
  title?: string;
  features?: WhyFeature[];
}

export function WhyDapurDekaka({ title, features }: WhyDapurDekakaProps) {
  const t = useTranslations('why');

  const resolvedTitle = title || t('title');
  const resolvedFeatures: WhyFeature[] =
    features && features.length > 0
      ? features
      : [0, 1, 2].map((i) => ({
          title: t(`features_${i}_title` as 'features_0_title'),
          description: t(`features_${i}_description` as 'features_0_description'),
        }));

  return (
    <section className="py-12 px-4 bg-brand-cream">
      <div className="container mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5 }}
          className="font-display text-2xl md:text-3xl font-semibold text-center mb-8"
        >
          {resolvedTitle}
        </motion.h2>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8"
        >
          {resolvedFeatures.map((feature, i) => {
            const IconComponent = iconComponents[i % iconComponents.length]!;
            return (
              <motion.div key={`${feature.title}-${i}`} variants={itemVariants} className="text-center">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-brand-red/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <IconComponent className="w-7 h-7 md:w-8 md:h-8 text-brand-red" strokeWidth={1.5} />
                </div>
                <h3 className="font-display font-semibold text-lg mb-2 text-text-primary">
                  {feature.title}
                </h3>
                <p className="text-text-secondary text-sm">{feature.description}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
