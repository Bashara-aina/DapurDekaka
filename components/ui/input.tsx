import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

export interface InputProps extends React.ComponentProps<"input"> {
  error?: string;
}

function Input({ className, type, error, name, ...props }: InputProps) {
  const inputErrorId = error ? `input-error-${name || Math.random()}` : undefined;
  return (
    <div className="relative">
      <InputPrimitive
        type={type}
        name={name}
        data-slot="input"
        className={cn(
          "h-10 w-full min-w-0 rounded-lg border border-brand-cream-dark bg-transparent px-3 py-1.5 text-base transition-colors outline-none placeholder:text-text-muted focus-visible:border-brand-red focus-visible:ring-2 focus-visible:ring-brand-red/10 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
          error && "border-error focus-visible:border-error focus-visible:ring-error/10",
          className
        )}
        aria-invalid={!!error}
        aria-describedby={inputErrorId}
        {...props}
      />
      {error && (
        <p id={inputErrorId} className="mt-1 text-xs text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export { Input }
