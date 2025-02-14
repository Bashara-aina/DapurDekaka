import { useQuery } from "@tanstack/react-query";
import { Article } from "@shared/schema";
import { sampleArticles } from "@shared/articles-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

export default function Articles() {
  const { data: articles } = useQuery<Article[]>({
    queryKey: ["/api/articles"],
    queryFn: async () => sampleArticles,
  });

  return (
    <div className="container mx-auto py-16 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl mx-auto text-center mb-12"
      >
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Articles & Insights</h1>
        <p className="text-lg text-gray-600">
          Explore the rich culture and traditions of dim sum through our curated articles
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
      >
        {articles?.map((article, index) => (
          <motion.div
            key={article.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <Link href={`/articles/${article.id}`}>
              <Card className="group cursor-pointer overflow-hidden hover:shadow-lg transition-all duration-300 h-full">
                <div className="aspect-video relative overflow-hidden">
                  <img
                    src={article.imageUrl}
                    alt={article.title}
                    className="object-cover w-full h-full transform group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <CardHeader>
                  <CardTitle className="text-xl group-hover:text-primary transition-colors duration-300 line-clamp-2">
                    {article.title}
                  </CardTitle>
                  <div className="flex items-center text-sm text-gray-500">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {new Date(article.publishedAt).toLocaleDateString('id-ID', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 line-clamp-3">
                    {article.summary}
                  </p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}