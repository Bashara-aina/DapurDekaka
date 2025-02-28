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

  const { data: post, isLoading, error } = useQuery<BlogPost>({
    queryKey: ["blog", id],
    queryFn: async () => {
      if (!id) throw new Error("Invalid article ID");
      const response = await fetch(`/api/blog/${id}`);
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to fetch article");
      }
      return response.json();
    },
    enabled: !!id,
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

  if (!post) return (
    <div className="container mx-auto py-16 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Article not found</h1>
        <p className="mt-2 text-gray-600">The article you're looking for doesn't exist or has been removed.</p>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto py-8 px-4">
      <motion.article
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="prose prose-lg mx-auto"
      >
        <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
        <div className="flex items-center gap-2 text-gray-600 mb-8">
          <CalendarIcon className="w-4 h-4" />
          <time>{new Date(post.createdAt).toLocaleDateString()}</time>
        </div>
        {post.imageUrl && (
          <img
            src={post.imageUrl}
            alt={post.title}
            className="w-full h-[400px] object-cover rounded-lg mb-8"
          />
        )}
        <div 
          className="blog-content"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      </motion.article>
    </div>
  );

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
            <div className="relative w-full h-[400px] mb-8 rounded-lg overflow-hidden">
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
            {post.content.split('\n\n').map((paragraph, index) => (
              paragraph.trim() && (
                <p key={index} className="mb-6 text-gray-700 leading-relaxed">
                  {paragraph}
                </p>
              )
            ))}
          </div>
        </motion.article>
      </div>
    </>
  );
}