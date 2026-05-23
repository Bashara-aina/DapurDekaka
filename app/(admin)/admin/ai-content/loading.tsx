import { Skeleton } from '@/components/ui/skeleton';

export default function AIContentLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="bg-white rounded-xl border border-admin-border p-6">
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  );
}