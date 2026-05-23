interface HalalBadgeProps {
  className?: string;
}

export function HalalBadge({ className }: HalalBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-600 text-[10px] font-bold rounded-badge ${className ?? ''}`}
    >
      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
        <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>
      HALAL
    </span>
  );
}
