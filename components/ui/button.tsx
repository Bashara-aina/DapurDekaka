import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-button border border-transparent text-sm font-medium whitespace-nowrap transition-all outline-none select-none active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-brand-red text-white hover:bg-brand-red-dark shadow-button",
        outline: "border-brand-cream-dark bg-white text-text-primary hover:bg-surface-off",
        secondary: "bg-brand-navy text-white hover:bg-brand-navy-light",
        ghost: "text-text-primary hover:bg-surface-off",
        destructive: "bg-error text-white hover:bg-error/90",
        link: "text-brand-red underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 gap-1.5 px-3",
        default: "h-10 gap-2 px-4",
        lg: "h-12 gap-2 px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
