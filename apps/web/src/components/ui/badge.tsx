import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center border px-3 py-1 caption font-medium transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-300 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary-600 active:bg-primary-700 rounded-full",
        secondary:
          "border-transparent bg-primary-50 text-primary-700 hover:bg-primary-100 active:bg-primary-200 rounded-full",
        destructive:
          "border-transparent bg-error text-white hover:bg-error/90 active:bg-error/80 rounded-full",
        outline: "text-primary border-primary hover:bg-primary hover:text-primary-foreground active:bg-primary-600 rounded-full",
        success: "border-transparent bg-success text-white hover:bg-success/90 active:bg-success/80 rounded-full",
        warning: "border-transparent bg-warning text-white hover:bg-warning/90 active:bg-warning/80 rounded-full",
        info: "border-transparent bg-info text-white hover:bg-info/90 active:bg-info/80 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }