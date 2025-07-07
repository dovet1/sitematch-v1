import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-medium ring-offset-background transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 violet-bloom-touch",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-600 active:bg-primary-700 border border-primary hover:border-primary-600 rounded-md",
        destructive:
          "bg-error text-white hover:bg-error/90 active:bg-error/80 border border-error hover:border-error/90 rounded-md",
        outline:
          "border border-primary bg-transparent text-primary hover:bg-primary hover:text-primary-foreground active:bg-primary-600 rounded-md",
        secondary:
          "bg-primary-50 text-primary-700 hover:bg-primary-100 active:bg-primary-200 border border-primary-200 hover:border-primary-300 rounded-md",
        ghost: "bg-transparent text-primary hover:bg-primary-50 active:bg-primary-100 rounded-md",
        link: "text-primary underline-offset-4 hover:underline bg-transparent",
      },
      size: {
        default: "h-11 px-6 py-3 text-base font-medium",
        sm: "h-9 px-4 py-2 text-sm font-medium",
        lg: "h-12 px-8 py-3 text-lg font-semibold",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }