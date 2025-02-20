import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

type FeatureCard = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
};

type AboutContent = {
  title: string;
  description: string;
  whyChooseTitle: string;
  whyChooseDescription: string;
  mainImage: string;
  features: FeatureCard[];
};

export default function About() {
  const { data: content, isLoading } = useQuery<AboutContent>({
    queryKey: ["/api/pages/about"],
    queryFn: async () => {
      const response = await fetch("/api/pages/about");
      if (!response.ok) throw new Error("Failed to fetch about content");
      return response.json();
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
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
          className="grid grid-cols-1 md:grid-cols-2 gap-12 items-stretch"
        >
          <div className="h-full">
            <img
              src={content?.mainImage || "asset/28.jpg"}
              alt="Our Kitchen"
              className="w-full h-full object-cover rounded-lg shadow-lg"
            />
          </div>
          <div className="flex flex-col justify-center">
            <div className="prose prose-xl">
              <p className="text-2xl text-gray-600 leading-relaxed">
                {content?.description || "Loading description..."}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-20"
        >
          <div className="prose prose-xl max-w-none">
            <h2 className="text-4xl font-bold text-gray-900 mb-8 text-center">
              {content?.whyChooseTitle || "Why Choose Dapur Dekaka?"}
            </h2>
            <p className="text-xl text-gray-600 text-center mb-12">
              {content?.whyChooseDescription || "Loading description..."}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {content?.features.map((feature, index) => (
                <div key={feature.id} className="p-6 bg-white rounded-lg shadow-lg overflow-hidden">
                  <img 
                    src={feature.imageUrl} 
                    alt={feature.title} 
                    className="w-full h-48 object-cover rounded-lg mb-4" 
                  />
                  <h3 className="text-2xl font-semibold mb-4">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}