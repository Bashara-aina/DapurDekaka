import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BlogPost } from "@shared/schema";
import { useRoute } from "wouter";
import { CalendarIcon } from "lucide-react";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet";

export default function ArticleDetail() {
  const [, params] = useRoute<{ id: string }>("/article/:id");
  const id = params?.id ? parseInt(params.id) : undefined;

  const { data: post, isLoading } = useQuery<BlogPost>({
    queryKey: ["/api/blog", id],
    queryFn: async () => {
      if (!id) throw new Error("Invalid article ID");
      const response = await fetch(`/api/blog/${id}`);
      if (!response.ok) throw new Error("Failed to fetch article");
      return response.json();
    },
    enabled: !!id,
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (isLoading) return <div>Loading...</div>;
  if (!post) return <div>Article not found</div>;

  return (
    <>
      <Helmet>
        <title>{post.title} - Dapur Dekaka</title>
        <meta name="description" content={post.content.slice(0, 155)} />
        <meta property="og:title" content={`${post.title} - Dapur Dekaka`} />
        <meta property="og:description" content={post.content.slice(0, 155)} />
        {post.imageUrl && <meta property="og:image" content={post.imageUrl} />}
      </Helmet>

      <div className="container mx-auto py-16 px-4">
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto"
        >
          {post.imageUrl && (
            <img
              src={post.imageUrl}
              alt={post.title}
              className="w-full h-[400px] object-cover rounded-lg mb-8"
              loading="lazy"
            />
          )}

          <h1 className="text-4xl font-bold text-gray-900 mb-4">{post.title}</h1>
          
          <div className="flex items-center text-sm text-gray-500 mb-8">
            <CalendarIcon className="mr-2 h-4 w-4" />
            {new Date(post.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </div>

          <div className="prose prose-lg max-w-none">
            {post.content.split('\n').map((paragraph, index) => (
              <p key={index} className="mb-4">
                {paragraph}
              </p>
            ))}
          </div>
        </motion.article>
      </div>
    </>
  );
}
