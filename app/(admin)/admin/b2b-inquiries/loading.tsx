import { Skeleton } from '@/components/ui/skeleton';

export default function B2BInquiriesLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}