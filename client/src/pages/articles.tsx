import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BlogPost } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon, Search } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { SEOHead } from "@/components/SEOHead";
import { ImageOptimizer } from "@/components/ImageOptimizer";
import { Input } from "@/components/ui/input";

// Helper function to sanitize HTML content
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function Articles() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredPosts, setFilteredPosts] = useState<BlogPost[]>([]);
  
  const { data: posts, isLoading, error } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog"],
    queryFn: async () => {
      const response = await fetch("/api/blog", {
        headers: { 'Cache-Control': 'max-age=300' }
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to fetch posts");
      }
      return response.json();
    },
    staleTime: 300000, // Consider data fresh for 5 minutes
    refetchOnWindowFocus: false
  });

  // Filter posts based on search term
  useEffect(() => {
    if (!posts) return;
    
    const published = posts.filter(post => post.published === 1);
    
    if (!searchTerm.trim()) {
      setFilteredPosts(published);
      return;
    }
    
    const normalizedSearch = searchTerm.toLowerCase().trim();
    const filtered = published.filter(post => 
      post.title.toLowerCase().includes(normalizedSearch) || 
      stripHtml(post.content).toLowerCase().includes(normalizedSearch)
    );
    
    setFilteredPosts(filtered);
  }, [posts, searchTerm]);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Schema markup for article list page
  const blogListSchema = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "Dapur Dekaka Blog",
    "description": "Discover delicious dim sum recipes, cooking tips, and food culture articles",
    "url": typeof window !== 'undefined' ? window.location.href : '',
    "publisher": {
      "@type": "Organization",
      "name": "Dapur Dekaka",
      "logo": {
        "@type": "ImageObject",
        "url": typeof window !== 'undefined' ? `${window.location.origin}/logo/logo.png` : ''
      }
    },
    "blogPosts": filteredPosts?.map(post => ({
      "@type": "BlogPosting",
      "headline": post.title,
      "datePublished": new Date(post.createdAt).toISOString(),
      "dateModified": new Date(post.updatedAt || post.createdAt).toISOString(),
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": typeof window !== 'undefined' ? `${window.location.origin}/article/${post.id}` : ''
      },
      "author": {
        "@type": "Organization",
        "name": "Dapur Dekaka"
      },
      "image": post.imageUrl ? (
        typeof window !== 'undefined' ? `${window.location.origin}${post.imageUrl}` : ''
      ) : undefined
    }))
  };

  // Loading state
  if (isLoading) return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  );

  return (
    <>
      <SEOHead
        title="Blog & Articles - Dapur Dekaka"
        description="Discover premium halal dim sum recipes, cooking tips, and food culture articles from Dapur Dekaka"
        keywords="halal dim sum, Dapur Dekaka blog, dim sum recipes, Indonesian food, cooking tips, food articles"
        ogType="website"
        ogImage="/asset/1.jpg"
        twitterCard="summary_large_image"
      />

      {/* Add structured data for better search engine understanding */}
      <script type="application/ld+json">
        {JSON.stringify(blogListSchema)}
      </script>

      <div className="container mx-auto py-16 px-4">
        {/* Page header with search functionality */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-12 gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Blog & Articles</h1>
            <p className="text-gray-600 max-w-2xl">
              Explore our collection of articles about dim sum recipes, food culture, and cooking tips
            </p>
          </div>
          
          {/* Search box */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="search"
              placeholder="Search articles..."
              className="pl-10 pr-4"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search articles"
            />
          </div>
        </div>

        {/* Show search result count when filtering */}
        {searchTerm && (
          <p className="mb-6 text-gray-500" role="status" aria-live="polite">
            Found {filteredPosts.length} articles matching "{searchTerm}"
          </p>
        )}

        {/* Article grid */}
        {filteredPosts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPosts.map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: Math.min(index * 0.1, 0.5) }}
              >
                <Link href={`/article/${post.id}`}>
                  <Card className="h-full hover:shadow-lg transition-shadow duration-300">
                    {post.imageUrl && (
                      <div className="aspect-video relative overflow-hidden rounded-t-lg">
                        <ImageOptimizer
                          src={post.imageUrl}
                          alt={post.title}
                          width={400}
                          height={225}
                          className="w-full h-full"
                          objectFit="cover"
                          priority={index < 3} // Priority load first three articles
                        />
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle className="line-clamp-2 text-xl">
                        {/* Use h2 for better heading hierarchy */}
                        <h2>{post.title}</h2>
                      </CardTitle>
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
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600 line-clamp-3">
                        {stripHtml(post.content).slice(0, 160)}...
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">No articles found matching your search criteria.</p>
          </div>
        )}
      </div>
    </>
  );
}