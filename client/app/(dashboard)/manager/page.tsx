import Link from "next/link"
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Package,
  Plus,
  ShoppingCart,
  Wallet,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Panel } from "@/components/panel"
import { StockFlowChart } from "@/components/stock-flow-chart"
import { cn } from "@/lib/utils"

// Mock data. Replace with database queries or API calls.
const stats = [
  { title: "Total products", value: "1,248", note: "+4.2% this month", tone: "good", icon: Package, href: "/manager/inventory" },
  { title: "Low stock alerts", value: "12", note: "Needs attention", tone: "bad", icon: AlertTriangle, href: "/manager/inventory", alert: true },
  { title: "Active orders", value: "34", note: "8 pending approval", tone: "neutral", icon: ShoppingCart, href: "/manager/orders" },
  { title: "Stock value", value: "R 482,500", note: "+12.1% vs last month", tone: "good", icon: Wallet, href: "/manager/reports" },
] as const

const TONE = {
  good: "text-green-600 dark:text-green-400",
  bad: "text-red-600 dark:text-red-400",
  neutral: "text-muted-foreground",
}

const lowStock = [
  { sku: "BEV-042", name: "Energy Drink 500ml", category: "Beverages", current: 4, min: 15 },
  { sku: "SNK-112", name: "Organic Protein Bar 60g", category: "Snacks", current: 6, min: 20 },
  { sku: "STA-001", name: "A4 Hardcover Notebook 192p", category: "Stationery", current: 8, min: 10 },
  { sku: "HSE-003", name: "Dish Soap 750ml", category: "Household", current: 9, min: 12 },
]

const movements = [
  { id: 1, sku: "BEV-001", product: "Sparkling Mineral Water 500ml", type: "IN", qty: "+120", user: "manager_admin", time: "10 mins ago" },
  { id: 2, sku: "SNK-001", product: "Artisanal Potato Chips 125g", type: "OUT", qty: "-15", user: "clerk_sarah", time: "35 mins ago" },
  { id: 3, sku: "STA-001", product: "A4 Hardcover Notebook 192p", type: "IN", qty: "+50", user: "manager_admin", time: "2 hours ago" },
  { id: 4, sku: "STA-014", product: "Ballpoint Pens (box of 50)", type: "OUT", qty: "-8", user: "clerk_sarah", time: "3 hours ago" },
  { id: 5, sku: "HSE-003", product: "Dish Soap 750ml", type: "IN", qty: "+36", user: "controller_james", time: "Yesterday" },
]

const pendingOrders = [
  { id: "PO-1004", supplier: "Initech", items: "6 crates of parts", total: "R 5,100" },
  { id: "PO-1006", supplier: "Umbrella Co", items: "Cleaning supplies", total: "R 640" },
  { id: "PO-1008", supplier: "Globex", items: "Packaging materials", total: "R 1,750" },
]

export default function ManagerDashboardPage() {
  return (
    <div className="flex flex-col gap-5">
      {/* Heading and quick actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Overview</h2>
          <p className="text-sm text-muted-foreground">
            Inventory health, stock movements and pending approvals.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="rounded-sm">
            <Link href="/manager/inventory">
              <Plus /> Add product
            </Link>
          </Button>
          <Button asChild className="rounded-sm">
            <Link href="/manager/reports">
              <FileText /> Generate report
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI strip: gap-px over a border-colored background draws the dividers */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border bg-border lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.title}
            href={s.href}
            className="bg-card transition-colors hover:bg-muted/40"
          >
            <div
              className={cn(
                "flex h-full flex-col gap-3 p-4",
                "alert" in s && s.alert && "bg-red-500/5"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {s.title}
                </span>
                <s.icon
                  className={cn(
                    "size-4",
                    "alert" in s && s.alert ? "text-red-500" : "text-muted-foreground"
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

      {/* Chart and low stock */}
      <div className="grid gap-4 lg:grid-cols-3">
        <StockFlowChart className="lg:col-span-2" />

        <Panel
          title="Low stock"
          description="Below the minimum level"
          href="/manager/inventory"
          linkLabel="View all 12"
        >
          <ul className="divide-y">
            {lowStock.map((item) => {
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
      </div>

      {/* Activity and pending approvals */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Recent activity"
          description="Latest stock adjustments"
          href="/manager/reports"
          linkLabel="Audit log"
          className="lg:col-span-2"
        >
          <ul className="divide-y">
            {movements.map((m) => {
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
                      isIn ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                    )}
                  >
                    {m.qty}
                  </span>
                </li>
              )
            })}
          </ul>
        </Panel>

        <Panel
          title="Awaiting approval"
          description={`${pendingOrders.length} orders need a decision`}
          href="/manager/orders"
          linkLabel="Review"
        >
          <ul className="divide-y">
            {pendingOrders.map((o) => (
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
                <span className="text-sm font-medium tabular-nums">{o.total}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  )
}