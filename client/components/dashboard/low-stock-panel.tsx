import { Panel } from "@/components/panel"
import { cn } from "@/lib/utils"

export type LowStockItem = {
  sku: string
  name: string
  category: string
  current: number
  min: number
}

export function LowStockPanel({
  items,
  href,
  linkLabel,
  className,
}: {
  items: LowStockItem[]
  href: string
  linkLabel?: string
  className?: string
}) {
  return (
    <Panel
      title="Low stock"
      description="Below the minimum level"
      href={href}
      linkLabel={linkLabel}
      className={className}
    >
      <ul className="divide-y">
        {items.map((item) => {
          const pct = Math.round((item.current / item.min) * 100)
          const critical = pct < 50
          return (
            <li key={item.sku} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{item.sku}</span> · {item.category}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-sm px-2 py-0.5 text-xs font-medium",
                    critical
                      ? "bg-red-500/10 text-red-600 dark:text-red-400"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  )}
                >
                  {critical ? "Critical" : "Low"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      critical ? "bg-red-500" : "bg-amber-500"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {item.current} / {item.min}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}