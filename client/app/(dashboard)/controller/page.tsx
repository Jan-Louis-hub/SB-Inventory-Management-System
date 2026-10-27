import Link from "next/link"
import {
  AlertTriangle,
  ArrowLeftRight,
  ClipboardCheck,
  PackageCheck,
  Truck,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Panel } from "@/components/panel"
import { KpiStrip, type Kpi } from "@/components/dashboard/kpi-strip"
import {
  LowStockPanel,
  type LowStockItem,
} from "@/components/dashboard/low-stock-panel"
import {
  ActivityPanel,
  type Movement,
} from "@/components/dashboard/activity-panel"
import { StockFlowChart } from "@/components/stock-flow-chart"
import { cn } from "@/lib/utils"
import { movementsFor } from "@/lib/activity"
import {
  getScheduledCountSummary,
  getUpcomingCounts,
} from "@/lib/counts"
import { getInventorySnapshot, getLowStockPreview } from "@/lib/inventory"
import { getControllerIncoming, getOrderSnapshot } from "@/lib/orders"

// No prices anywhere: stock controllers don't see order values.
const snap = getInventorySnapshot()
const orderSnap = getOrderSnapshot()
const countSnap = getScheduledCountSummary()
const lowStock: LowStockItem[] = getLowStockPreview()
const movements: Movement[] = movementsFor("controller")
const incoming = getControllerIncoming()
const counts = getUpcomingCounts()
const dueToday = incoming.filter((order) => order.due === "Today")

const stats: Kpi[] = [
  { title: "Below minimum", value: String(snap.belowMin), note: `${snap.critical} critical`, tone: snap.belowMin > 0 ? "bad" : "good", icon: AlertTriangle, href: "/controller/stock", alert: snap.belowMin > 0 },
  { title: "Due today", value: String(dueToday.length), note: dueToday[0]?.supplier ?? "Nothing due", tone: "neutral", icon: Truck, href: "/controller/orders" },
  { title: "To check in", value: String(orderSnap.toCheckIn), note: "Approved, shipped or delayed", tone: "neutral", icon: PackageCheck, href: "/controller/orders" },
  { title: "Counts due", value: String(countSnap.due), note: countSnap.note, tone: "neutral", icon: ClipboardCheck, href: "/controller/counts" },
]

type Status = "approved" | "shipped" | "delayed"

const STATUS_STYLES: Record<Status, string> = {
  approved: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  shipped: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  delayed: "bg-red-500/10 text-red-600 dark:text-red-400",
}

// "due" is a plain string so the page never reads the clock during prerender
export default function ControllerDashboardPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Overview</h2>
          <p className="text-sm text-muted-foreground">
            Deliveries to check in, stock levels and upcoming counts.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="rounded-sm">
            <Link href="/controller/counts">
              <ClipboardCheck /> Start count
            </Link>
          </Button>
          <Button asChild className="rounded-sm">
            <Link href="/controller/stock">
              <ArrowLeftRight /> Record stock
            </Link>
          </Button>
        </div>
      </div>

      <KpiStrip items={stats} />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* No href: controllers have no reports page */}
        <StockFlowChart className="lg:col-span-2" />
        <LowStockPanel
          items={lowStock}
          href="/controller/stock"
          linkLabel={`View all ${snap.belowMin}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Incoming deliveries"
          description="Orders waiting to be checked in"
          href="/controller/orders"
          linkLabel="All orders"
          className="lg:col-span-2"
        >
          <ul className="divide-y">
            {incoming.map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-muted text-xs font-semibold">
                  {o.supplier.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{o.supplier}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="font-mono">{o.id}</span> · {o.items}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-medium capitalize",
                      STATUS_STYLES[o.status]
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-current" />
                    {o.status}
                  </span>
                  <span
                    className={cn(
                      "text-xs",
                      o.status === "delayed"
                        ? "text-red-600 dark:text-red-400"
                        : "text-muted-foreground"
                    )}
                  >
                    {o.due}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Stock counts"
          description="Scheduled and in progress"
          href="/controller/counts"
          linkLabel="All counts"
        >
          <ul className="divide-y">
            {counts.map((c) => (
              <li key={c.area} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.area}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.items} items
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {c.due}
                  </span>
                </div>
                {c.progress > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${c.progress}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {c.progress}%
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <ActivityPanel
        items={movements}
        href="/controller/stock"
        linkLabel="Stock log"
      />
    </div>
  )
}