import { ArrowDownLeft, ArrowUpRight } from "lucide-react"

import { Panel } from "@/components/panel"
import { cn } from "@/lib/utils"

export type Movement = {
  id: number
  sku: string
  product: string
  type: "IN" | "OUT"
  qty: string
  user: string
  time: string
}

export function ActivityPanel({
  items,
  href,
  linkLabel,
  className,
  title = "Recent activity",
  description = "Latest stock adjustments",
}: {
  items: Movement[]
  href: string
  linkLabel?: string
  className?: string
  title?: string
  description?: string
}) {
  return (
    <Panel
      title={title}
      description={description}
      href={href}
      linkLabel={linkLabel}
      className={className}
    >
      <ul className="divide-y">
        {items.map((m) => {
          const isIn = m.type === "IN"
          return (
            <li key={m.id} className="flex items-center gap-3 px-4 py-3">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-sm",
                  isIn
                    ? "bg-green-500/10 text-green-600 dark:text-green-400"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                )}
              >
                {isIn ? (
                  <ArrowDownLeft className="size-4" />
                ) : (
                  <ArrowUpRight className="size-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.product}</p>
                <p className="truncate text-xs text-muted-foreground">
                  <span className="font-mono">{m.sku}</span> · {m.user} · {m.time}
                </p>
              </div>
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  isIn
                    ? "text-green-600 dark:text-green-400"
                    : "text-muted-foreground"
                )}
              >
                {m.qty}
              </span>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}