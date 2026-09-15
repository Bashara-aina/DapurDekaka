import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--brand-cream-dark)_25%,var(--brand-cream)_50%,var(--brand-cream-dark)_75%)] bg-[length:200%_100%]",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
