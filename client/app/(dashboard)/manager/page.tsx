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

// Mock data. Replace with database queries or API calls.
const stats: Kpi[] = [
  { title: "Total products", value: "1,248", note: "+4.2% this month", tone: "good", icon: Package, href: "/manager/inventory" },
  { title: "Low stock alerts", value: "12", note: "Needs attention", tone: "bad", icon: AlertTriangle, href: "/manager/inventory", alert: true },
  { title: "Active orders", value: "34", note: "8 pending approval", tone: "neutral", icon: ShoppingCart, href: "/manager/orders" },
  { title: "Stock value", value: "R 482,500", note: "+12.1% vs last month", tone: "good", icon: Wallet, href: "/manager/reports" },
]

const lowStock: LowStockItem[] = [
  { sku: "BEV-042", name: "Energy Drink 500ml", category: "Beverages", current: 4, min: 15 },
  { sku: "SNK-112", name: "Organic Protein Bar 60g", category: "Snacks", current: 6, min: 20 },
  { sku: "STA-001", name: "A4 Hardcover Notebook 192p", category: "Stationery", current: 8, min: 10 },
  { sku: "HSE-003", name: "Dish Soap 750ml", category: "Household", current: 9, min: 12 },
]

const movements: Movement[] = [
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
          linkLabel="View all 12"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ActivityPanel
          items={movements}
          href="/manager/reports"
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