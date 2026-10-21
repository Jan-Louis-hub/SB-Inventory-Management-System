import Link from "next/link"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type Kpi = {
  title: string
  value: string
  note: string
  tone: "good" | "bad" | "neutral"
  icon: LucideIcon
  href: string
  alert?: boolean
}

const TONE = {
  good: "text-green-600 dark:text-green-400",
  bad: "text-red-600 dark:text-red-400",
  neutral: "text-muted-foreground",
}

// gap-px over a border-colored background draws the dividers
export function KpiStrip({ items }: { items: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border bg-border lg:grid-cols-4">
      {items.map((s) => (
        <Link
          key={s.title}
          href={s.href}
          className="bg-card transition-colors hover:bg-muted/40"
        >
          <div
            className={cn(
              "flex h-full flex-col gap-3 p-4",
              s.alert && "bg-red-500/5"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {s.title}
              </span>
              <s.icon
                className={cn(
                  "size-4",
                  s.alert ? "text-red-500" : "text-muted-foreground"
                )}
              />
            </div>
            <p className="text-2xl font-semibold tabular-nums tracking-tight">
              {s.value}
            </p>
            <p className={cn("text-xs", TONE[s.tone])}>{s.note}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}