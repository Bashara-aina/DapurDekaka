import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BlogPost } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet";

export default function Articles() {
  const { data: posts, isLoading, error } = useQuery<BlogPost[]>({
    queryKey: ["blog"],
    queryFn: async () => {
      const response = await fetch("/api/blog");
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to fetch posts");
      }
      return response.json();
    },
    retry: false
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
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Blog & Articles</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts?.map((post) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Link href={`/article/${post.id}`}>
                <Card className="h-full hover:shadow-lg transition-shadow duration-300">
                  {post.imageUrl && (
                    <div className="aspect-video relative overflow-hidden rounded-t-lg">
                      <img
                        src={post.imageUrl}
                        alt={post.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="line-clamp-2">{post.title}</CardTitle>
                    <div className="flex items-center text-sm text-gray-500">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {new Date(post.createdAt).toLocaleDateString()}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 line-clamp-3">{post.content}</p>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </>
  );
}