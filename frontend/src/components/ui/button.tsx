import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none select-none cursor-pointer active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 border border-indigo-500/30",
        outline:
          "border border-border/60 bg-transparent text-foreground shadow-sm hover:bg-accent",
        secondary:
          "border border-border/60 bg-muted text-foreground shadow-sm hover:bg-muted/80",
        ghost:
          "text-foreground hover:bg-accent",
        destructive:
          "bg-red-600 text-white shadow-sm hover:bg-red-500 border border-red-500/30",
        link:
          "text-indigo-500 dark:text-indigo-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 gap-1.5 px-4 py-2",
        xs: "h-7 gap-1 rounded px-2 text-xs",
        sm: "h-8 gap-1 rounded-md px-3 text-sm",
        lg: "h-10 gap-2 rounded-md px-6 text-base",
        icon: "size-9",
        "icon-xs": "size-7 rounded",
        "icon-sm": "size-8 rounded-md",
        "icon-lg": "size-10",
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
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
