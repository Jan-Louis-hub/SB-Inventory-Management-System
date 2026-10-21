import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

const TONES = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  success: "bg-green-500/10 text-green-600 dark:text-green-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  danger: "bg-red-500/10 text-red-600 dark:text-red-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
}

export type Tone = keyof typeof TONES

export function StatusBadge({
  tone = "neutral",
  dot = true,
  className,
  children,
}: {
  tone?: Tone
  dot?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-medium",
        TONES[tone],
        className
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}