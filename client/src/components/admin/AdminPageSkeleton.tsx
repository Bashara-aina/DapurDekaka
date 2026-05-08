import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AdminPageSkeletonProps {
  title?: string;
  showScrollArea?: boolean;
  scrollAreaHeight?: string;
  showTabs?: boolean;
  showCards?: boolean;
  cardCount?: number;
}

export function AdminPageSkeleton({
  title = "Loading...",
  showScrollArea = false,
  scrollAreaHeight = "h-[calc(100vh-200px)]",
  showTabs = false,
  showCards = false,
  cardCount = 3,
}: AdminPageSkeletonProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-10 w-36" />
      </div>

      {showTabs && (
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      )}

      {showCards && (
        showScrollArea ? (
          <ScrollArea className={scrollAreaHeight}>
            <div className="space-y-4">
              {Array.from({ length: cardCount }).map((_, i) => (
                <Card key={i} className="p-6 border border-gray-200">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-full mt-2" />
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: cardCount }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-48 w-full mb-4" />
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full" />
              </Card>
            ))}
          </div>
        )
      )}

      {!showCards && (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-3/4" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function AdminFormSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}