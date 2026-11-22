import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface AdminPlainGuideProps {
  title: string;
  children: ReactNode;
  className?: string;
}

/**
 * Plain-language how-to banner for non-technical owner/admin screens.
 */
export default function AdminPlainGuide({
  title,
  children,
  className,
}: AdminPlainGuideProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800',
        className
      )}
    >
      <p className="font-medium">{title}</p>
      <div className="mt-1 space-y-1 text-slate-600">{children}</div>
    </div>
  );
}
