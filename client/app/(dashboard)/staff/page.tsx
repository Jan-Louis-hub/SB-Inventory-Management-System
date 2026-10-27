import { Suspense } from "react"
import Link from "next/link"
import { cookies } from "next/headers"
import { AlertTriangle, Package, Truck } from "lucide-react"

import { KpiStrip, type Kpi } from "@/components/dashboard/kpi-strip"
import { LowStockPanel } from "@/components/dashboard/low-stock-panel"
import { Panel } from "@/components/panel"
import { Button } from "@/components/ui/button"
import { getBackendUrl } from "@/lib/auth-proxy"

type Product = { sku: string; name: string; category: { name: string } | null; quantity: number; reorder_level: number }
type Order = { purchase_number: string; supplier: string; expected_date: string | null; status: string }
type Request = { request_number: string; product: string; quantity: number; status: string }

async function load(path: string, token: string) {
  const response = await fetch(`${getBackendUrl()}/api/${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
  if (!response.ok) throw new Error("Unable to load current inventory data")
  return response.json()
}

async function StaffDashboardData() {
  const token = (await cookies()).get("sb_inventory_session")?.value
  let products: Product[] = []
  let orders: Order[] = []
  let requests: Request[] = []
  let failed = false
  if (token) {
    try {
      const [productResult, orderResult, requestResult] = await Promise.all([
        load("products?is_active=true&per_page=100", token),
        load("purchase-orders", token),
        load("stock-requests", token),
      ])
      products = productResult.products
      orders = orderResult.purchase_orders
      requests = requestResult.stock_requests
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
    { title: "Products", value: failed ? "—" : String(products.length), note: "In the catalogue", tone: "neutral", icon: Package, href: "/staff/inventory" },
    { title: "Low stock", value: failed ? "—" : String(lowProducts.length), note: "At or below reorder level", tone: lowProducts.length ? "bad" : "good", icon: AlertTriangle, href: "/staff/inventory", alert: lowProducts.length > 0 },
    { title: "Incoming orders", value: failed ? "—" : String(incoming.length), note: "Current purchase orders", tone: "neutral", icon: Truck },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Overview</h2>
          <p className="text-sm text-muted-foreground">Live inventory and supplier deliveries.</p>
        </div>
        <Button asChild className="rounded-sm"><Link href="/staff/inventory"><Package /> Browse inventory</Link></Button>
      </div>
      {failed && <p role="alert" className="text-sm text-destructive">Live dashboard data is unavailable. Check the backend connection.</p>}
      <KpiStrip items={stats} />
      <div className="grid gap-4 lg:grid-cols-3">
        <LowStockPanel items={lowProducts} href="/staff/inventory" linkLabel={`View all ${lowProducts.length}`} className="lg:col-span-1" />
        <Panel title="Incoming purchase orders" description="Current orders awaiting stock receipt" className="lg:col-span-2">
          {incoming.length ? (
            <ul className="divide-y">
              {incoming.slice(0, 5).map((order) => (
                <li key={order.purchase_number} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{order.supplier}</p>
                    <p className="font-mono text-xs text-muted-foreground">{order.purchase_number}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{order.expected_date || "Expected date not set"}</span>
                </li>
              ))}
            </ul>
          ) : <p className="p-4 text-sm text-muted-foreground">{failed ? "Order data unavailable." : "No incoming orders."}</p>}
        </Panel>
      </div>
      <Panel title="Stock requests" description="Request replenishment from the inventory team">
        {requests.length ? (
          <ul className="divide-y">
            {requests.slice(0, 5).map((request) => (
              <li key={request.request_number} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm">{request.product} × {request.quantity}</span>
                <span className="text-xs capitalize text-muted-foreground">{request.status}</span>
              </li>
            ))}
          </ul>
        ) : <p className="p-4 text-sm text-muted-foreground">{failed ? "Request data unavailable." : "No stock requests yet."}</p>}
        <div className="p-4 pt-0"><Button asChild variant="outline" size="sm"><Link href="/staff/requests">Manage requests</Link></Button></div>
      </Panel>
    </div>
  )
}

export default function StaffDashboardPage() {
  return (
    <Suspense fallback={null}>
      <StaffDashboardData />
    </Suspense>
  )
}
