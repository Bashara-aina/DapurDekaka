import { useQuery } from "@tanstack/react-query";
import { BlogPost } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarIcon, ArrowRight, Loader2 } from "lucide-react";
import { Link } from "wouter";

function decodeHtmlEntities(text: string) {
  const textArea = document.createElement('textarea');
  textArea.innerHTML = text;
  return textArea.value;
}

function stripHtmlAndDecodeEntities(html: string) {
  // First remove HTML tags
  const strippedHtml = html.replace(/<[^>]+>/g, ' ');
  // Then decode HTML entities
  return decodeHtmlEntities(strippedHtml);
}

export default function FeaturedArticles() {
  const { data: posts, isLoading: postsLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog"],
    queryFn: async () => {
      const response = await fetch("/api/blog");
      if (!response.ok) throw new Error("Failed to fetch posts");
      const posts = await response.json();
      return posts
        .filter((post: BlogPost) => post.published === 1)
        .sort((a: BlogPost, b: BlogPost) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 2);
    },
  });

  const { data: pageData, isLoading: pageLoading } = useQuery({
    queryKey: ['/api/pages/homepage'],
    queryFn: async () => {
      const response = await fetch('/api/pages/homepage');
      if (!response.ok) throw new Error('Failed to fetch homepage data');
      return response.json();
    }
  });

  if (postsLoading || pageLoading) {
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
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-2xl group-hover:text-primary transition-colors duration-300">
                      {decodeHtmlEntities(post.title)}
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
                    <p className="text-gray-600 line-clamp-2">
                      {stripHtmlAndDecodeEntities(post.content)}
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