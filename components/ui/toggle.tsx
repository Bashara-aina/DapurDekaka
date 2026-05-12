import * as React from "react"
import { cn } from "@/lib/utils"

export interface ToggleProps extends React.ComponentProps<"button"> {
  pressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  disabled?: boolean;
  className?: string;
}

function Toggle({ className, pressed, onPressedChange, disabled, ...props }: ToggleProps) {
  return (
    <button
      type="button"
      role="toggle"
      aria-pressed={pressed}
      data-slot="toggle"
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-brand-cream hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/20 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-brand-cream data-[state=on]:text-brand-red",
        className
      )}
      onClick={() => onPressedChange?.(!pressed)}
      disabled={disabled}
      data-state={pressed ? "on" : "off"}
      {...props}
    />
  );
}

export { Toggle }