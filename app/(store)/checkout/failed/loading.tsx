import { Skeleton } from '@/components/ui/skeleton';

export default function CheckoutFailedLoading() {
  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <Skeleton className="h-16 w-16 mx-auto rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-6 w-64 mx-auto" />
        </div>
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </div>
  );
}