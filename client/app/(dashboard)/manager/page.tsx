import { Suspense } from "react"
import Link from "next/link"
import { cookies } from "next/headers"
import { AlertTriangle, FileText, Package, Plus, ShoppingCart, Wallet } from "lucide-react"

import { ActivityPanel, type Movement } from "@/components/dashboard/activity-panel"
import { KpiStrip, type Kpi } from "@/components/dashboard/kpi-strip"
import { LowStockPanel } from "@/components/dashboard/low-stock-panel"
import { StockFlowChart } from "@/components/stock-flow-chart"
import { Panel } from "@/components/panel"
import { Button } from "@/components/ui/button"
import { money } from "@/lib/format"
import { getBackendUrl } from "@/lib/auth-proxy"

type Product = {
  id: number
  sku: string
  name: string
  category: { name: string } | null
  quantity: number
  reorder_level: number
  cost_price: string
}

type Order = {
  purchase_number: string
  supplier: string
  total_amount: string
  status: string
}
type StockRequest = {
  id: number
  request_number: string
  requester: string
  product: string
  quantity: number
  status: string
}

async function load(path: string, token: string) {
  const response = await fetch(`${getBackendUrl()}/api/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!response.ok) throw new Error("Unable to load current inventory data")
  return response.json()
}

async function ManagerDashboardData() {
  const token = (await cookies()).get("sb_inventory_session")?.value
  let products: Product[] = []
  let orders: Order[] = []
  let movements: Movement[] = []
  let stockRequests: StockRequest[] = []
  let failed = false
  if (token) {
    try {
      const [productResult, orderResult, movementResult, requestResult] = await Promise.all([
        load("products?is_active=true&per_page=100", token),
        load("purchase-orders", token),
        load("stock-movements?per_page=5", token),
        load("stock-requests", token),
      ])
      products = productResult.products
      orders = orderResult.purchase_orders
      movements = movementResult.stock_movements.map((entry: {
        id: number
        product_id: number
        product_name: string
        quantity_change: number
        actor: string | null
        created_at: string
      }) => ({
        id: entry.id,
        sku: `Product ${entry.product_id}`,
        product: entry.product_name,
        type: entry.quantity_change > 0 ? "IN" : "OUT",
        qty: `${entry.quantity_change > 0 ? "+" : ""}${entry.quantity_change}`,
        user: entry.actor ?? "Unknown",
        time: new Date(entry.created_at).toLocaleString(),
      }))
      stockRequests = requestResult.stock_requests
    } catch {
      failed = true
    }
  } else {
    failed = true
  }

  const lowProducts = products
    .filter((product) => product.quantity <= product.reorder_level)
    .map((product) => ({
      sku: product.sku,
      name: product.name,
      category: product.category?.name ?? "Uncategorized",
      current: product.quantity,
      min: product.reorder_level,
    }))
  const openOrders = orders.filter((order) => order.status === "ordered" || order.status === "partial")
  const stats: Kpi[] = [
    { title: "Total products", value: failed ? "—" : String(products.length), note: "Active products", tone: "neutral", icon: Package, href: "/manager/inventory" },
    { title: "Low stock alerts", value: failed ? "—" : String(lowProducts.length), note: "At or below reorder level", tone: lowProducts.length ? "bad" : "good", icon: AlertTriangle, href: "/manager/inventory", alert: lowProducts.length > 0 },
    { title: "Open orders", value: failed ? "—" : String(openOrders.length), note: "Ordered or partly received", tone: "neutral", icon: ShoppingCart, href: "/manager/orders" },
    { title: "Stock value", value: failed ? "—" : money.format(products.reduce((sum, product) => sum + product.quantity * Number(product.cost_price), 0)), note: "At unit cost", tone: "neutral", icon: Wallet, href: "/manager/reports" },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Overview</h2>
          <p className="text-sm text-muted-foreground">Current inventory, purchase orders and recorded stock movements.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="rounded-sm"><Link href="/manager/inventory"><Plus /> Add product</Link></Button>
          <Button asChild className="rounded-sm"><Link href="/manager/reports"><FileText /> Reports</Link></Button>
        </div>
      </div>
      {failed && <p role="alert" className="text-sm text-destructive">Live dashboard data is unavailable. Check the backend connection.</p>}
      <KpiStrip items={stats} />
      <div className="grid gap-4 lg:grid-cols-3">
        <StockFlowChart className="lg:col-span-2" href="/manager/reports" linkLabel="Reports" />
        <LowStockPanel items={lowProducts} href="/manager/inventory" linkLabel={`View all ${lowProducts.length}`} />
      </div>
      <Panel
        title="Stock requests"
        description={`${stockRequests.filter((request) => request.status === "pending").length} requests awaiting review`}
        href="/manager/requests"
        linkLabel="Review"
      >
        {stockRequests.length ? (
          <ul className="divide-y">
            {stockRequests.slice(0, 5).map((request) => (
              <li key={request.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{request.product} × {request.quantity}</p>
                  <p className="font-mono text-xs text-muted-foreground">{request.request_number} · {request.requester}</p>
                </div>
                <span className="text-xs capitalize text-muted-foreground">{request.status}</span>
              </li>
            ))}
          </ul>
        ) : <p className="p-4 text-sm text-muted-foreground">{failed ? "Request data unavailable." : "No stock requests yet."}</p>}
      </Panel>
      <div className="grid gap-4 lg:grid-cols-3">
        <ActivityPanel items={movements} href="/manager/reports#audit" linkLabel="Movement ledger" className="lg:col-span-2" />
        <Panel title="Open purchase orders" description={`${openOrders.length} orders are awaiting receipt`} href="/manager/orders" linkLabel="Review">
          {openOrders.length ? (
            <ul className="divide-y">
              {openOrders.slice(0, 5).map((order) => (
                <li key={order.purchase_number} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{order.supplier}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{order.purchase_number}</p>
                  </div>
                  <span className="text-sm font-medium tabular-nums">{money.format(Number(order.total_amount))}</span>
                </li>
              ))}
            </ul>
          ) : <p className="p-4 text-sm text-muted-foreground">{failed ? "Order data unavailable." : "No open orders."}</p>}
        </Panel>
      </div>
    </div>
  )
}

export default function ManagerDashboardPage() {
  return (
    <Suspense fallback={null}>
      <ManagerDashboardData />
    </Suspense>
  )
}
