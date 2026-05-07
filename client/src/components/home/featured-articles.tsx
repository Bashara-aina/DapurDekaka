import { useQuery } from "@tanstack/react-query";
import { BlogPost } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarIcon, ArrowRight, Loader2, Star, Clock, User } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface BlogListResponse {
  success: boolean;
  data: BlogPost[];
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

function decodeHtmlEntities(text: string) {
  const textArea = document.createElement('textarea');
  textArea.innerHTML = text;
  return textArea.value;
}

function stripHtmlAndDecodeEntities(html: string) {
  const strippedHtml = html.replace(/<[^>]+>/g, ' ');
  return decodeHtmlEntities(strippedHtml);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function FeaturedArticles() {
  const { t, language } = useLanguage();

  // Fetch featured posts first, fall back to latest 2 if none
  const { data: featuredResponse, isLoading: featuredLoading } = useQuery<BlogListResponse>({
    queryKey: ["api", "blog", "featured"],
    queryFn: async () => {
      const response = await fetch("/api/blog?featured=true&limit=2", {
        headers: { 'Cache-Control': 'max-age=300' }
      });
      if (!response.ok) throw new Error("Failed to fetch posts");
      return response.json();
    },
    staleTime: 300000,
    gcTime: 600000,
    refetchOnWindowFocus: false,
  });

  // Fallback to latest posts if no featured posts
  const { data: latestResponse, isLoading: latestLoading } = useQuery<BlogListResponse>({
    queryKey: ["api", "blog", "latest"],
    queryFn: async () => {
      const response = await fetch("/api/blog?limit=2", {
        headers: { 'Cache-Control': 'max-age=300' }
      });
      if (!response.ok) throw new Error("Failed to fetch posts");
      return response.json();
    },
    staleTime: 300000,
    gcTime: 600000,
    refetchOnWindowFocus: false,
  });

  const { data: pageData, isLoading: pageLoading } = useQuery({
    queryKey: ["pages", "homepage"],
    queryFn: async () => {
      const response = await fetch('/api/pages/homepage', {
        headers: { 'Cache-Control': 'max-age=300' }
      });
      if (!response.ok) throw new Error('Failed to fetch homepage data');
      return response.json();
    },
    staleTime: 300000,
    gcTime: 600000,
    refetchOnWindowFocus: false,
  });

  const isLoading = featuredLoading || latestLoading || pageLoading;

  // Use featured posts if available, otherwise fall back to latest
  const posts = featuredResponse?.data?.length
    ? featuredResponse.data
    : (latestResponse?.data || []).slice(0, 2);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!posts?.length) return null;

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex justify-between items-center mb-12"
        >
          <div>
            <h2 className="text-3xl font-bold text-gray-900">
              {pageData?.content.latestArticles.title || "Latest Articles"}
            </h2>
            <p className="text-gray-600 mt-2">
              {pageData?.content.latestArticles.subtitle || "Discover our latest news and updates"}
            </p>
          </div>
          <Link href="/articles">
            <Button variant="ghost" className="group">
              View All Articles
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {posts.map((post, index) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Link href={`/article/${post.id}`}>
                <Card className="group cursor-pointer overflow-hidden hover:shadow-lg transition-all duration-300">
                  {post.imageUrl && (
                    <div className="aspect-video relative overflow-hidden">
                      <img
                        src={post.imageUrl}
                        alt={post.title}
                        className="object-cover w-full h-full transform group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      {post.featured === 1 && (
                        <div className="absolute top-3 right-3 bg-yellow-500 text-white px-2 py-1 rounded-full flex items-center gap-1 text-xs font-medium">
                          <Star className="w-3 h-3 fill-white" />
                          Featured
                        </div>
                      )}
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      {post.category && (
                        <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full capitalize">
                          {post.category}
                        </span>
                      )}
                      {post.featured === 1 && !post.imageUrl && (
                        <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full flex items-center gap-1">
                          <Star className="w-3 h-3 fill-yellow-500" />
                          Featured
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-2xl group-hover:text-primary transition-colors duration-300">
                      {decodeHtmlEntities(post.title)}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                      {post.authorName && (
                        <div className="flex items-center">
                          <User className="mr-1 h-4 w-4" />
                          {post.authorName}
                        </div>
                      )}
                      <div className="flex items-center">
                        <CalendarIcon className="mr-1 h-4 w-4" />
                        {new Date(post.createdAt).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>
                      {post.readTime && (
                        <div className="flex items-center">
                          <Clock className="mr-1 h-4 w-4" />
                          {post.readTime} min
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 line-clamp-2">
                      {post.excerpt || stripHtmlAndDecodeEntities(post.content).slice(0, 150)}...
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}