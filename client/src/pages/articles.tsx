import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BlogPost } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon, Search, Loader2, ChevronLeft, ChevronRight, Star, Clock, User } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { SEOHead } from "@/components/SEOHead";
import { ImageOptimizer } from "@/components/ImageOptimizer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/useDebounce";

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

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function ArticleCardSkeleton() {
  return (
    <Card className="h-full">
      <Skeleton className="aspect-video rounded-t-lg" />
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-6 w-3/4" />
        <div className="flex items-center gap-3 mt-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
    </Card>
  );
}

function ErrorState({ onRetry, t }: { onRetry: () => void; t: (key: string) => string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <p className="text-gray-600">Failed to load articles. Please try again.</p>
      <Button onClick={onRetry} variant="outline">
        {t('common.buttons.retry')}
      </Button>
    </div>
  );
}

function EmptyState({ searchTerm }: { searchTerm: string }) {
  return (
    <div className="text-center py-16">
      <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
      <p className="text-gray-600 mb-2">
        {searchTerm
          ? `No articles found matching "${searchTerm}"`
          : "No articles available yet."}
      </p>
      {searchTerm && (
        <Link href="/articles">
          <Button variant="link">Clear search</Button>
        </Link>
      )}
    </div>
  );
}

export default function Articles() {
  const { t, language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<string | undefined>();
  const [totalPages, setTotalPages] = useState(1);

  const debouncedSearch = useDebounce(searchTerm, 300);
  const limit = 6;

  const { data: response, isLoading, error, refetch } = useQuery<BlogListResponse>({
    queryKey: ["/api/blog", page, limit, category, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (category) params.set('category', category);
      if (debouncedSearch) params.set('search', debouncedSearch);

      const response = await fetch(`/api/blog?${params.toString()}`, {
        headers: { 'Cache-Control': 'max-age=300' }
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to fetch posts");
      }
      return response.json();
    },
    staleTime: 300000,
    refetchOnWindowFocus: false
  });

  const filteredPosts = response?.data || [];

  useEffect(() => {
    if (response?.meta?.totalPages) {
      setTotalPages(response.meta.totalPages);
    }
  }, [response]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  useEffect(() => {
    setPage(1);
  }, [category, debouncedSearch]);

  const schemaBlogPosts = useMemo(() => filteredPosts.map(post => ({
    "@type": "BlogPosting",
    "headline": post.title,
    "datePublished": new Date(post.createdAt).toISOString(),
    "dateModified": new Date(post.updatedAt || post.createdAt).toISOString(),
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `${typeof window !== 'undefined' ? window.location.origin : ''}/article/${post.id}`
    },
    "author": {
      "@type": "Person",
      "name": post.authorName || "Dapur Dekaka"
    },
    "image": post.imageUrl ? `${typeof window !== 'undefined' ? window.location.origin : ''}${post.imageUrl}` : undefined
  })), [filteredPosts]);

  if (error) {
    return (
      <>
        <SEOHead
          title="Blog & Articles - Dapur Dekaka"
          description="Discover premium halal dim sum recipes, cooking tips, and food culture articles from Dapur Dekaka"
          ogType="website"
          ogImage="/logo/logo.png"
        />
        <ErrorState onRetry={() => refetch()} t={t} />
      </>
    );
  }

  return (
    <>
      <SEOHead
        title="Blog & Articles - Dapur Dekaka"
        description="Discover premium halal dim sum recipes, cooking tips, and food culture articles from Dapur Dekaka"
        keywords="halal dim sum, Dapur Dekaka blog, dim sum recipes, Indonesian food, cooking tips, food articles"
        ogType="website"
        ogImage="/logo/logo.png"
        twitterCard="summary_large_image"
        canonicalUrl={page > 1 ? `/articles?page=${page}` : undefined}
        schemaType="WebSite"
      />

      <script type="application/ld+json">
        {JSON.stringify([{
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
          "blogPosts": schemaBlogPosts
        }])}
      </script>

      <div className="container mx-auto py-16 px-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-12 gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">{t('articles.title')}</h1>
            <p className="text-gray-600 max-w-2xl">
              {t('articles.subtitle')}
            </p>
          </div>

          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="search"
              placeholder={t('common.placeholders.searchArticles')}
              className="pl-10 pr-4"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search articles"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          <Button
            variant={category === undefined ? "default" : "outline"}
            size="sm"
            onClick={() => { setCategory(undefined); setPage(1); }}
          >
            All
          </Button>
          {["dim sum", "recipes", "cooking tips", "food culture", "halal", "reviews"].map(cat => (
            <Button
              key={cat}
              variant={category === cat ? "default" : "outline"}
              size="sm"
              onClick={() => { setCategory(cat); setPage(1); }}
              className="capitalize"
            >
              {cat}
            </Button>
          ))}
        </div>

        {debouncedSearch && (
          <p className="mb-6 text-gray-500" role="status" aria-live="polite">
            {language === 'id'
              ? `Ditemukan ${filteredPosts.length} artikel yang sesuai dengan "${debouncedSearch}"`
              : `Found ${filteredPosts.length} articles matching "${debouncedSearch}"`}
          </p>
        )}

        {response?.meta && (
          <p className="mb-6 text-sm text-gray-500">
            {language === 'id' ? 'Menampilkan' : 'Showing'} {filteredPosts.length}{' '}
            {language === 'id' ? 'artikel dari' : 'of'} {response.meta.total}{' '}
            {language === 'id' ? 'total' : 'total'}
          </p>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <ArticleCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredPosts.length > 0 ? (
          <>
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
                            priority={index < 3}
                          />
                          {post.featured === 1 && (
                            <div className="absolute top-2 right-2 bg-yellow-500 text-white px-2 py-1 rounded-full flex items-center gap-1 text-xs font-medium">
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
                        <CardTitle className="line-clamp-2 text-xl">
                          <h2>{post.title}</h2>
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                          <div className="flex items-center">
                            <CalendarIcon className="mr-1 h-4 w-4" />
                            <time dateTime={new Date(post.createdAt).toISOString()}>
                              {new Date(post.createdAt).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </time>
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
                        <p className="text-gray-600 line-clamp-3">
                          {post.excerpt || stripHtml(post.content).slice(0, 160)}...
                        </p>
                        {post.authorName && (
                          <div className="flex items-center mt-4 text-sm text-gray-500">
                            <User className="mr-1 h-4 w-4" />
                            {post.authorName}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-12">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-gray-500 px-4">
                  {t("articles.page")} {page} {t("articles.of")} {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        ) : (
          <EmptyState searchTerm={debouncedSearch} />
        )}
      </div>
    </>
  );
}