
import { useQuery } from "@tanstack/react-query";
import { BlogPost } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

export default function Articles() {
  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog"],
    queryFn: async () => {
      const response = await fetch("/api/blog");
      if (!response.ok) throw new Error("Failed to fetch posts");
      return response.json();
    },
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto py-16 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl mx-auto text-center mb-12"
      >
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Blog & Articles</h1>
        <p className="text-lg text-gray-600">
          Stay updated with our latest news and insights
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
      >
        {posts?.map((post, index) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <Card className="group cursor-pointer overflow-hidden hover:shadow-lg transition-all duration-300 h-full">
              <CardHeader>
                <CardTitle className="text-xl group-hover:text-primary transition-colors duration-300 line-clamp-2">
                  {post.title}
                </CardTitle>
                <div className="flex items-center text-sm text-gray-500">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {new Date(post.createdAt).toLocaleDateString('id-ID', {
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
        ))}
      </motion.div>
    </div>
  );
}
