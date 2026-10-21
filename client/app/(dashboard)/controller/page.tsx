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

// Mock data. Replace with database queries or API calls.
// No prices anywhere: stock controllers don't see order values.
const stats: Kpi[] = [
  { title: "Below minimum", value: "12", note: "4 critical", tone: "bad", icon: AlertTriangle, href: "/controller/stock", alert: true },
  { title: "Due today", value: "3", note: "1 delayed", tone: "neutral", icon: Truck, href: "/controller/orders" },
  { title: "To check in", value: "7", note: "Approved, shipped or delayed", tone: "neutral", icon: PackageCheck, href: "/controller/orders" },
  { title: "Counts due", value: "2", note: "Next: Aisle 4, tomorrow", tone: "neutral", icon: ClipboardCheck, href: "/controller/counts" },
]

const lowStock: LowStockItem[] = [
  { sku: "BEV-042", name: "Energy Drink 500ml", category: "Beverages", current: 4, min: 15 },
  { sku: "SNK-112", name: "Organic Protein Bar 60g", category: "Snacks", current: 6, min: 20 },
  { sku: "STA-001", name: "A4 Hardcover Notebook 192p", category: "Stationery", current: 8, min: 10 },
  { sku: "HSE-003", name: "Dish Soap 750ml", category: "Household", current: 9, min: 12 },
]

const movements: Movement[] = [
  { id: 1, sku: "BEV-001", product: "Sparkling Mineral Water 500ml", type: "IN", qty: "+120", user: "controller_james", time: "10 mins ago" },
  { id: 2, sku: "SNK-001", product: "Artisanal Potato Chips 125g", type: "OUT", qty: "-15", user: "clerk_sarah", time: "35 mins ago" },
  { id: 3, sku: "STA-001", product: "A4 Hardcover Notebook 192p", type: "IN", qty: "+50", user: "controller_james", time: "2 hours ago" },
  { id: 4, sku: "STA-014", product: "Ballpoint Pens (box of 50)", type: "OUT", qty: "-8", user: "clerk_sarah", time: "3 hours ago" },
]

type Status = "approved" | "shipped" | "delayed"

const STATUS_STYLES: Record<Status, string> = {
  approved: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  shipped: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  delayed: "bg-red-500/10 text-red-600 dark:text-red-400",
}

// "due" is a plain string so the page never reads the clock during prerender
const incoming: {
  id: string
  supplier: string
  items: string
  due: string
  status: Status
}[] = [
  { id: "PO-1001", supplier: "Acme Supplies", items: "24 boxes of widgets", due: "Today", status: "shipped" },
  { id: "PO-1003", supplier: "Globex", items: "Packaging materials", due: "2 days overdue", status: "delayed" },
  { id: "PO-1002", supplier: "FreshCo", items: "10 pallets of stock", due: "In 3 days", status: "approved" },
  { id: "PO-1009", supplier: "Hooli", items: "Shelving units", due: "In 5 days", status: "approved" },
]

const counts = [
  { area: "Aisle 4: Beverages", items: 86, due: "Tomorrow", progress: 0 },
  { area: "Back store", items: 142, due: "Friday", progress: 35 },
  { area: "Aisle 1: Stationery", items: 64, due: "Next week", progress: 0 },
]

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
          linkLabel="View all 12"
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