import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-button border border-transparent text-sm font-medium whitespace-nowrap transition-all outline-none select-none active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-brand-red text-white hover:bg-brand-red-dark shadow-button",
        primary: "bg-brand-red text-white hover:bg-brand-red-dark shadow-button",
        outline: "border-brand-red bg-transparent text-brand-red hover:bg-brand-red/5",
        secondary: "bg-brand-cream border border-brand-red text-brand-red hover:bg-brand-cream-dark",
        ghost: "text-text-secondary hover:bg-surface-off hover:text-text-primary",
        destructive: "bg-error text-white hover:bg-error/90",
        whatsapp: "bg-whatsapp-green text-white hover:bg-whatsapp-green-dark shadow-button",
        link: "text-brand-red underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 gap-1.5 px-3 min-h-[36px]",
        default: "h-11 gap-2 px-4 min-h-[44px]",
        lg: "h-12 gap-2 px-6 min-h-[48px]",
        xl: "h-14 gap-2 px-8 text-base min-h-[56px]",
        icon: "h-11 w-11 min-h-[44px] min-w-[44px]",
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
