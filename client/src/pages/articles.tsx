import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BlogPost } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet";

export default function Articles() {
  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog"],
    queryFn: async () => {
      const response = await fetch("/api/blog");
      if (!response.ok) throw new Error("Failed to fetch posts");
      return response.json();
    },
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (isLoading) return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  );

  return (
    <>
      <Helmet>
        <title>Blog & Articles - Dapur Dekaka</title>
        <meta name="description" content="Discover delicious dim sum recipes, cooking tips, and food culture articles" />
        <meta property="og:title" content="Blog & Articles - Dapur Dekaka" />
        <meta property="og:description" content="Discover delicious dim sum recipes, cooking tips, and food culture articles" />
      </Helmet>

      <div className="container mx-auto py-16 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl mx-auto text-center mb-12"
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Blog & Articles</h1>
          <p className="text-lg text-gray-600">
            Discover our latest stories and insights
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {posts?.map((post, index) => (
            <Link key={post.id} href={`/article/${post.id}`}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -5 }}
                className="h-full"
              >
                <Card className="cursor-pointer h-full hover:shadow-lg transition-all duration-300">
                  {post.imageUrl && (
                    <div className="relative w-full h-48 overflow-hidden rounded-t-lg">
                      <img
                        src={post.imageUrl}
                        alt={post.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/image/placeholder.jpg';
                          target.onerror = null;
                        }}
                      />
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="line-clamp-2 hover:text-primary transition-colors">
                      {post.title}
                    </CardTitle>
                    <div className="flex items-center text-sm text-gray-500">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {new Date(post.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 line-clamp-3">
                      {post.content}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </Link>
          ))}
        </motion.div>
      </div>
    </>
  );
}