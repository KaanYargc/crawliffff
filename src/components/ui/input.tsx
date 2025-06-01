import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm",
          "placeholder:text-zinc-500 focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-zinc-950/5 dark:border-zinc-800",
          "dark:bg-zinc-950 dark:ring-zinc-300/10 dark:focus-visible:ring-zinc-300/10",
          "dark:placeholder:text-zinc-400 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
