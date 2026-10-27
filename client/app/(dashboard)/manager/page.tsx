import Link from "next/link"
import {
  AlertTriangle,
  FileText,
  Package,
  Plus,
  ShoppingCart,
  Wallet,
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
import { movementsFor } from "@/lib/activity"
import { money } from "@/lib/format"
import { getInventorySnapshot, getLowStockPreview } from "@/lib/inventory"
import { getOrderSnapshot, getPendingApprovals } from "@/lib/orders"

const snap = getInventorySnapshot()
const orderSnap = getOrderSnapshot()
const lowStock: LowStockItem[] = getLowStockPreview()
const movements: Movement[] = movementsFor("manager")
const pendingOrders = getPendingApprovals()

const stats: Kpi[] = [
  { title: "Total products", value: String(snap.products), note: `${snap.categories} categories`, tone: "good", icon: Package, href: "/manager/inventory" },
  { title: "Low stock alerts", value: String(snap.belowMin), note: `${snap.critical} critical`, tone: snap.belowMin > 0 ? "bad" : "good", icon: AlertTriangle, href: "/manager/inventory", alert: snap.belowMin > 0 },
  { title: "Active orders", value: String(orderSnap.open), note: `${orderSnap.pending} pending approval`, tone: "neutral", icon: ShoppingCart, href: "/manager/orders" },
  { title: "Stock value", value: money.format(snap.value), note: "At unit cost", tone: "good", icon: Wallet, href: "/manager/reports" },
]

export const instant = false

export default function ManagerDashboardPage() {
  return (
    <div className="flex flex-col gap-5">
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

      <KpiStrip items={stats} />

      <div className="grid gap-4 lg:grid-cols-3">
        <StockFlowChart
          className="lg:col-span-2"
          href="/manager/reports"
          linkLabel="Reports"
        />
        <LowStockPanel
          items={lowStock}
          href="/manager/inventory"
          linkLabel={`View all ${snap.belowMin}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ActivityPanel
          items={movements}
          href="/manager/reports#audit"
          linkLabel="Audit log"
          className="lg:col-span-2"
        />

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