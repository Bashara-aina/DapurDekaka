import * as React from "react"
import { cn } from "@/lib/utils"

export interface LabelProps extends React.ComponentProps<"label"> {
  error?: boolean;
  hint?: string;
}

function Label({ className, error, hint, children, ...props }: LabelProps) {
  return (
    <div className="flex flex-col gap-1">
      <label
        data-slot="label"
        className={cn(
          "text-sm font-medium leading-none text-text-primary peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
          error && "text-error",
          className
        )}
        {...props}
      >
        {children}
      </label>
      {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

export { Label }