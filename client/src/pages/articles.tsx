import { useQuery } from "@tanstack/react-query";
import { Article } from "@shared/schema";
import { sampleArticles } from "@shared/articles-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon } from "lucide-react";

export default function Articles() {
  // In a real app, we would fetch from API. For now using sample data
  const { data: articles } = useQuery<Article[]>({
    queryKey: ["/api/articles"],
    queryFn: async () => sampleArticles,
  });

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-4xl font-bold mb-8">Articles</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles?.map((article) => (
          <Card key={article.title} className="overflow-hidden hover:shadow-lg transition-shadow">
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
        ))}
      </div>
    </div>
  );
}
