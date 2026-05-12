import Image from 'next/image';

interface HalalBadgeProps {
  className?: string;
}

export function HalalBadge({ className }: HalalBadgeProps) {
  return (
    <span className={className}>
      <Image
        src="/assets/logo/halal.png"
        alt="Halal"
        width={48}
        height={20}
        className="h-5 w-auto object-contain"
      />
    </span>
  );
}
