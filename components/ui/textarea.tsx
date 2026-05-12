import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  error?: string;
}

function Textarea({ className, error, ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1">
      <textarea
        data-slot="textarea"
        className={cn(
          "min-h-[120px] w-full rounded-lg border border-brand-cream-dark bg-transparent px-3 py-2 text-base transition-colors outline-none placeholder:text-text-muted focus-visible:border-brand-red focus-visible:ring-2 focus-visible:ring-brand-red/10 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-none",
          error && "border-error focus-visible:border-error focus-visible:ring-error/10",
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  );
}

export { Textarea }