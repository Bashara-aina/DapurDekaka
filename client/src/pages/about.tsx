import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import type { PageContent } from "@shared/schema";

interface Feature {
  id: string;
  title: string;
  description: string;
  image: string;
}

interface Section {
  id: string;
  title: string;
  description: string;
  image: string;
}

interface AboutContent {
  title: string;
  description: string;
  mainImage: string;
  sections: Section[];
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

  const content = pageData?.content as AboutContent;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-20">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h1 className="text-6xl font-bold text-gray-900 mb-6">
            {content?.title || "About Dapur Dekaka"}
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-20"
        >
          <div className="h-full">
            <img
              src={content?.mainImage || "/asset/28.jpg"}
              alt="About Us"
              className="w-full h-full object-cover rounded-lg shadow-lg"
            />
          </div>
          <div className="flex flex-col justify-center">
            <div className="prose prose-xl">
              <p className="text-2xl text-gray-600 leading-relaxed">
                {content?.description}
              </p>
            </div>
          </div>
        </motion.div>

        {content?.sections.map((section, index) => (
          <motion.div
            key={section.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
            className="mb-20"
          >
            <div className="prose prose-xl max-w-none">
              <h2 className="text-4xl font-bold text-gray-900 mb-8 text-center">
                {section.title}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div className="order-2 md:order-1">
                  <p className="text-xl text-gray-600">
                    {section.description}
                  </p>
                </div>
                <div className="order-1 md:order-2">
                  <img
                    src={section.image}
                    alt={section.title}
                    className="w-full h-full object-cover rounded-lg shadow-lg"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        ))}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {content?.features.map((feature, index) => (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
                className="p-6 bg-white rounded-lg shadow-lg overflow-hidden"
              >
                <img
                  src={feature.image}
                  alt={feature.title}
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
                <h3 className="text-2xl font-semibold mb-4">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}