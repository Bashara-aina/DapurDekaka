import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BlogPost } from "@shared/schema";
import { useRoute, Link } from "wouter";
import { CalendarIcon, ArrowLeft, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import { SEOHead } from "@/components/SEOHead";
import { ImageOptimizer } from "@/components/ImageOptimizer";
import { Button } from "@/components/ui/button";

export default function ArticleDetail() {
  const [, params] = useRoute<{ id: string }>("/article/:id");
  const id = params?.id ? parseInt(params.id) : undefined;

  const { data: post, isLoading, error } = useQuery<BlogPost>({
    queryKey: ["/api/blog", id],
    queryFn: async () => {
      if (!id) throw new Error("Invalid article ID");
      const response = await fetch(`/api/blog/${id}`, {
        headers: { 'Cache-Control': 'max-age=300' }
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to fetch article");
      }
      return response.json();
    },
    enabled: !!id,
    retry: false,
    staleTime: 300000, // Consider data fresh for 5 minutes
    refetchOnWindowFocus: false
  });

  // Scroll to the top of the page when the component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Helper function to sanitize HTML for description meta tags
  const stripHtml = (html: string): string => {
    return html?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  };

  // Generate a clean description for meta tags
  const getMetaDescription = (content: string): string => {
    const stripped = stripHtml(content);
    return stripped.length > 160 ? stripped.substring(0, 157) + '...' : stripped;
  };

  // Loading state
  if (isLoading) return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  );

  // Error state - Article not found
  if (!post) return (
    <div className="container mx-auto py-16 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Article not found</h1>
        <p className="mt-2 text-gray-600">The article you're looking for doesn't exist or has been removed.</p>
        <Link href="/articles" className="mt-6 inline-block">
          <Button className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to articles
          </Button>
        </Link>
      </div>
    </div>
  );

  // Prepare structured data for SEO
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.title,
    "datePublished": new Date(post.createdAt).toISOString(),
    "dateModified": new Date(post.updatedAt || post.createdAt).toISOString(),
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": typeof window !== 'undefined' ? window.location.href : ''
    },
    "publisher": {
      "@type": "Organization",
      "name": "Dapur Dekaka",
      "logo": {
        "@type": "ImageObject",
        "url": typeof window !== 'undefined' ? `${window.location.origin}/logo/logo.png` : ''
      }
    },
    "author": {
      "@type": "Organization",
      "name": "Dapur Dekaka"
    },
    "description": getMetaDescription(post.content),
    "image": post.imageUrl ? (typeof window !== 'undefined' ? `${window.location.origin}${post.imageUrl}` : '') : undefined
  };

  // Get clean meta description
  const metaDescription = getMetaDescription(post.content);

  return (
    <>
      <SEOHead
        title={`${post.title} - Dapur Dekaka`}
        description={metaDescription}
        keywords={`halal dim sum, Dapur Dekaka, ${post.title}, food article, dim sum recipes`}
        ogType="article"
        ogImage={post.imageUrl || "/asset/1.jpg"}
        twitterCard="summary_large_image"
        canonicalUrl={typeof window !== 'undefined' ? window.location.href : ''}
      />

      {/* Add structured data for better search engine understanding */}
      <script type="application/ld+json">
        {JSON.stringify(articleSchema)}
      </script>

      <div className="container mx-auto py-10 px-4">
        {/* Back navigation */}
        <div className="max-w-3xl mx-auto mb-8">
          <Link href="/articles">
            <Button variant="ghost" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-4 w-4" />
              Back to articles
            </Button>
          </Link>
        </div>

        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto"
        >
          {/* Article header */}
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">{post.title}</h1>
            <div className="flex items-center text-sm text-gray-500">
              <CalendarIcon className="mr-2 h-4 w-4" />
              <time dateTime={new Date(post.createdAt).toISOString()}>
                {new Date(post.createdAt).toLocaleDateString('id-ID', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </time>
            </div>
          </header>

          {/* Featured image */}
          {post.imageUrl && (
            <figure className="relative w-full mb-8 rounded-lg overflow-hidden">
              <ImageOptimizer
                src={post.imageUrl}
                alt={post.title}
                width={1200}
                height={675}
                className="w-full h-auto max-h-[500px] object-cover"
                priority={true}
              />
              <figcaption className="text-sm text-gray-500 mt-2 italic text-center">
                {post.title} - Dapur Dekaka
              </figcaption>
            </figure>
          )}

          {/* Article content */}
          <div 
            className="prose prose-lg max-w-none mx-auto article-content"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* Article footer with sharing options */}
          <footer className="mt-12 pt-6 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-gray-600">
                Thanks for reading! Share this article:
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: post.title,
                        text: metaDescription,
                        url: window.location.href
                      }).catch(err => console.error('Error sharing:', err));
                    } else {
                      navigator.clipboard.writeText(window.location.href)
                        .then(() => alert('Link copied to clipboard!'))
                        .catch(err => console.error('Failed to copy:', err));
                    }
                  }}
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
                <Link href="/articles">
                  <Button size="sm">More articles</Button>
                </Link>
              </div>
            </div>
          </footer>
        </motion.article>
      </div>
    </>
  );
}