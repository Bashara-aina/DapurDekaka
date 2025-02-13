import { useQuery } from "@tanstack/react-query";
import { Article } from "@shared/schema";
import { sampleArticles } from "@shared/articles-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarIcon, ArrowRight } from "lucide-react";
import { Link } from "wouter";

export default function FeaturedArticles() {
  const { data: articles } = useQuery<Article[]>({
    queryKey: ["/api/articles"],
    queryFn: async () => sampleArticles.filter(article => article.featured === 1),
  });

  if (!articles?.length) return null;

  return (
    <section className="py-16 bg-slate-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">Featured Articles</h2>
          <Link href="/articles">
            <Button variant="ghost" className="group">
              View All Articles
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {articles.map((article) => (
            <Link key={article.id} href={`/articles/${article.id}`}>
              <a className="block">
                <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full">
                  <div className="aspect-video relative">
                    <img
                      src={article.imageUrl}
                      alt={article.title}
                      className="object-cover w-full h-full"
                    />
                  </div>
                  <CardHeader>
                    <CardTitle className="line-clamp-2">{article.title}</CardTitle>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {new Date(article.publishedAt).toLocaleDateString()}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground line-clamp-3">
                      {article.summary}
                    </p>
                  </CardContent>
                </Card>
              </a>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}