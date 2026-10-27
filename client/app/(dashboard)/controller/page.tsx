import { Suspense } from "react"
import Link from "next/link"
import { cookies } from "next/headers"
import { AlertTriangle, ArrowLeftRight, PackageCheck, Truck } from "lucide-react"

import { ActivityPanel, type Movement } from "@/components/dashboard/activity-panel"
import { KpiStrip, type Kpi } from "@/components/dashboard/kpi-strip"
import { LowStockPanel } from "@/components/dashboard/low-stock-panel"
import { StockFlowChart } from "@/components/stock-flow-chart"
import { Panel } from "@/components/panel"
import { Button } from "@/components/ui/button"
import { getBackendUrl } from "@/lib/auth-proxy"

type Product = { sku: string; name: string; category: { name: string } | null; quantity: number; reorder_level: number }
type Order = { id: number; purchase_number: string; supplier: string; status: string; expected_date: string | null; items: { product_name: string; quantity_ordered: number; quantity_received: number }[] }
type Count = { id: number; count_number: string; area: string; location: string; due_label: string; status: string }

async function load(path: string, token: string) {
  const response = await fetch(`${getBackendUrl()}/api/${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
  if (!response.ok) throw new Error("Unable to load current inventory data")
  return response.json()
}

async function ControllerDashboardData() {
  const token = (await cookies()).get("sb_inventory_session")?.value
  let products: Product[] = []
  let orders: Order[] = []
  let movements: Movement[] = []
  let counts: Count[] = []
  let failed = false
  if (token) {
    try {
      const [productResult, orderResult, movementResult, countResult] = await Promise.all([
        load("products?is_active=true&per_page=100", token),
        load("purchase-orders", token),
        load("stock-movements?per_page=5", token),
        load("stock-counts", token),
      ])
      products = productResult.products
      orders = orderResult.purchase_orders
      movements = movementResult.stock_movements.map((entry: {
        id: number; product_id: number; product_name: string; quantity_change: number; actor: string | null; created_at: string
      }) => ({
        id: entry.id,
        sku: `Product ${entry.product_id}`,
        product: entry.product_name,
        type: entry.quantity_change > 0 ? "IN" : "OUT",
        qty: `${entry.quantity_change > 0 ? "+" : ""}${entry.quantity_change}`,
        user: entry.actor ?? "Unknown",
        time: new Date(entry.created_at).toLocaleString(),
      }))
      counts = countResult.stock_counts
    } catch {
      failed = true
    }
  } else {
    failed = true
  }
  const lowProducts = products
    .filter((product) => product.quantity <= product.reorder_level)
    .map((product) => ({ sku: product.sku, name: product.name, category: product.category?.name ?? "Uncategorized", current: product.quantity, min: product.reorder_level }))
  const incoming = orders.filter((order) => order.status === "ordered" || order.status === "partial")
  const stats: Kpi[] = [
    { title: "Below minimum", value: failed ? "—" : String(lowProducts.length), note: "At or below reorder level", tone: lowProducts.length ? "bad" : "good", icon: AlertTriangle, href: "/controller/stock", alert: lowProducts.length > 0 },
    { title: "Open orders", value: failed ? "—" : String(incoming.length), note: "Waiting for receipt", tone: "neutral", icon: Truck, href: "/controller/orders" },
    { title: "Products", value: failed ? "—" : String(products.length), note: "Active inventory", tone: "neutral", icon: PackageCheck, href: "/controller/stock" },
    { title: "Recent movements", value: failed ? "—" : String(movements.length), note: "Latest recorded entries", tone: "neutral", icon: ArrowLeftRight, href: "/controller/stock" },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Overview</h2>
          <p className="text-sm text-muted-foreground">Current stock levels, incoming orders and recorded movements.</p>
        </div>
        <Button asChild className="rounded-sm"><Link href="/controller/stock"><ArrowLeftRight /> Record stock</Link></Button>
      </div>
      {failed && <p role="alert" className="text-sm text-destructive">Live dashboard data is unavailable. Check the backend connection.</p>}
      <KpiStrip items={stats} />
      <div className="grid gap-4 lg:grid-cols-3">
        <StockFlowChart className="lg:col-span-2" />
        <LowStockPanel items={lowProducts} href="/controller/stock" linkLabel={`View all ${lowProducts.length}`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Incoming purchase orders" description="Ordered stock waiting to be received" href="/controller/orders" linkLabel="All orders" className="lg:col-span-2">
          {incoming.length ? (
            <ul className="divide-y">
              {incoming.slice(0, 5).map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{order.supplier}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{order.purchase_number} · {order.items.map((item) => `${item.product_name} × ${item.quantity_ordered - item.quantity_received}`).join(", ")}</p>
                  </div>
                  <span className="text-xs capitalize text-muted-foreground">{order.status}</span>
                </li>
              ))}
            </ul>
          ) : <p className="p-4 text-sm text-muted-foreground">{failed ? "Order data unavailable." : "No incoming orders."}</p>}
        </Panel>
        <Panel title="Stock counts" description="Physical count planning" href="/controller/counts" linkLabel="Manage">
          {counts.length ? (
            <ul className="divide-y">
              {counts.slice(0, 4).map((count) => (
                <li key={count.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{count.area} · {count.location}</p>
                    <p className="font-mono text-xs text-muted-foreground">{count.count_number} · {count.due_label}</p>
                  </div>
                  <span className="text-xs capitalize text-muted-foreground">{count.status.replace("_", " ")}</span>
                </li>
              ))}
            </ul>
          ) : <p className="p-4 text-sm text-muted-foreground">{failed ? "Count data unavailable." : "No stock counts yet."}</p>}
        </Panel>
      </div>
      <ActivityPanel items={movements} href="/controller/stock" linkLabel="Stock log" />
    </div>
  )
}

export default function ControllerDashboardPage() {
  return (
    <Suspense fallback={null}>
      <ControllerDashboardData />
    </Suspense>
  )
}
