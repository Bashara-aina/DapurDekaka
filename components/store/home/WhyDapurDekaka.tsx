'use client';

import { motion } from 'framer-motion';

const features = [
  {
    icon: '✓',
    title: '100% Halal',
    description: 'Bersertifikat dan terjamin kehalalannya',
  },
  {
    icon: '❄️',
    title: 'Dikemas Frozen Fresh',
    description: 'Kualitas terjaga sampai tujuan',
  },
  {
    icon: '🚚',
    title: 'Kirim ke Seluruh Indonesia',
    description: 'Dari Bandung untuk Nusantara',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function WhyDapurDekaka() {
  return (
    <section className="py-12 px-4 bg-white">
      <div className="container mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5 }}
          className="font-display text-xl md:text-2xl font-semibold text-center mb-8"
        >
          Kenapa Dapur Dekaka?
        </motion.h2>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8"
        >
          {features.map((feature, index) => (
            <motion.div key={index} variants={itemVariants} className="text-center">
              <div className="w-14 h-14 md:w-16 md:h-16 bg-brand-red/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl md:text-3xl">{feature.icon}</span>
              </div>
              <h3 className="font-display font-semibold text-lg mb-2 text-text-primary">
                {feature.title}
              </h3>
              <p className="text-text-secondary text-sm">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}