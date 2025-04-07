
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import type { PageContent } from "@shared/schema";
import { SEOHead } from "@/components/SEOHead";
import { ImageOptimizer } from "@/components/ImageOptimizer";

interface Feature {
  id: string;
  title: string;
  description: string;
  image: string;
}

interface AboutContent {
  title: string;
  description: string;
  mainImage: string;
  mainDescription: string;
  sections: {
    title: string;
    description: string;
  }[];
  features: Feature[];
}

export default function About() {
  const { data: pageData, isLoading } = useQuery<PageContent>({
    queryKey: ["/api/pages/about"],
    queryFn: async () => {
      const response = await fetch("/api/pages/about");
      if (!response.ok) throw new Error("Failed to fetch about content");
      return response.json();
    }
  });

  const defaultContent: AboutContent = {
    title: "About Dapur Dekaka",
    description: "Learn about our journey, values, and the premium quality ingredients we use at Dapur Dekaka",
    mainImage: "/asset/28.jpg",
    mainDescription: "Dapur Dekaka adalah produsen frozen food dimsum berbagai varian. Berlokasi di Bandung, kami telah mendistribusikan produk sampai ke Jakarta, Bekasi, Tangerang, dan Palembang. Produk kami dibuat dengan resep khas turun temurun yang sudah lebih dari 5 tahun, alur produksinya memperhatikan keamanan pangan, kebersihan terjamin, tidak pakai pengawet, tidak pakai pewarna buatan. Prioritas kami terhadap konsistensi kualitas menjadikan kami selalu dipercaya oleh restoran, kafe, reseller, dan para pengusaha sebagai mitra.",
    sections: [{
      title: "Di Dapur Dekaka",
      description: "Di Dapur Dekaka, kami sangat bersemangat untuk menghadirkan cita rasa otentik dim sum buatan tangan ke meja Anda. Berbasis di Bandung, kami bangga memberikan produk berkualitas tinggi yang menonjol karena rasa dan integritasnya. Inilah alasan mengapa Anda harus memilih kami:"
    }],
    features: [
      {
        id: "premium",
        title: "Bahan-bahan Premium",
        description: "Kami hanya menggunakan bahan-bahan terbaik untuk memastikan rasa dan kualitas yang luar biasa.",
        image: "/asset/17.jpg"
      },
      {
        id: "handmade",
        title: "Keunggulan Buatan Tangan",
        description: "Setiap potongan dim sum dibuat dengan hati-hati, mempertahankan sentuhan tradisional.",
        image: "/asset/19.jpg"
      },
      {
        id: "halal",
        title: "Bersertifikat Halal",
        description: "Nikmati produk kami dengan tenang, karena telah memenuhi standar halal tertinggi.",
        image: "/asset/21.jpg"
      },
      {
        id: "preservative",
        title: "Tanpa Pengawet",
        description: "Kesegaran dan rasa alami adalah prioritas kami, tanpa bahan pengawet.",
        image: "/asset/23.jpg"
      }
    ]
  };

  const content = pageData?.content as AboutContent || defaultContent;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-20">
      <SEOHead 
        title={`${content.title} | Dapur Dekaka`}
        description={content.mainDescription.substring(0, 160)}
        keywords="halal dim sum, about us, Dapur Dekaka history, premium handmade dim sum"
        ogImage={content.mainImage}
        ogType="website"
      />
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h1 className="text-6xl font-bold text-gray-900 mb-6">
            {content.title}
          </h1>
        </motion.div>

        {/* Side by side main content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center mb-16 max-w-[75%] mx-auto"
        >
          <div className="h-full">
            <ImageOptimizer
              src={content.mainImage}
              alt="About Us"
              className="w-full h-full rounded-lg shadow-lg"
              objectFit="cover"
              priority={true}
              width={600}
              height={400}
            />
          </div>
          <div className="flex flex-col justify-center">
            <div className="prose prose-lg">
              <p className="text-2xl text-gray-600 leading-relaxed text-justify">
                {content.mainDescription}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Section with title and description */}
        {content.sections.map((section, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mb-20"
          >
            <div className="prose prose-xl max-w-none">
              <h2 className="text-4xl font-bold text-gray-900 mb-8 text-center">
                {section.title}
              </h2>
              <div className="text-xl text-gray-600 text-center max-w-4xl mx-auto">
                <p>{section.description}</p>
              </div>
            </div>
          </motion.div>
        ))}

        {/* Features grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
        >
          {content.features.map((feature, index) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
              className="bg-white rounded-lg shadow-lg overflow-hidden"
            >
              <ImageOptimizer
                src={feature.image}
                alt={feature.title}
                className="w-full h-48"
                objectFit="cover"
                width={300}
                height={200}
              />
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-4">
                  {feature.title}
                </h3>
                <p className="text-gray-600 text-justify">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom tagline */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="text-center mt-16"
        >
          <p className="text-2xl text-gray-600">
            Rasakan perbedaannya dengan dim sum kami yang autentik, beraroma, dan sehat hari ini!
          </p>
        </motion.div>
      </div>
    </div>
  );
}
