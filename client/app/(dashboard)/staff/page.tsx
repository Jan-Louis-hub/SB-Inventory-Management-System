import Link from "next/link"
import {
  AlertTriangle,
  Inbox,
  Package,
  Plus,
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
import { cn } from "@/lib/utils"

// Mock data. Replace with database queries or API calls.
// No prices and no order statuses: staff members only see what they need.
const stats: Kpi[] = [
  { title: "Products", value: "1,248", note: "In the catalogue", tone: "neutral", icon: Package, href: "/staff/inventory" },
  { title: "Low stock", value: "12", note: "4 critical", tone: "bad", icon: AlertTriangle, href: "/staff/inventory", alert: true },
  { title: "My open requests", value: "3", note: "1 approved", tone: "good", icon: Inbox, href: "/staff/requests" },
  { title: "Arriving this week", value: "4", note: "1 today", tone: "neutral", icon: Truck, href: "/staff" },
]

const lowStock: LowStockItem[] = [
  { sku: "BEV-042", name: "Energy Drink 500ml", category: "Beverages", current: 4, min: 15 },
  { sku: "SNK-112", name: "Organic Protein Bar 60g", category: "Snacks", current: 6, min: 20 },
  { sku: "STA-001", name: "A4 Hardcover Notebook 192p", category: "Stationery", current: 8, min: 10 },
  { sku: "HSE-003", name: "Dish Soap 750ml", category: "Household", current: 9, min: 12 },
]

// Only this user's own actions
const myActivity: Movement[] = [
  { id: 1, sku: "SNK-001", product: "Artisanal Potato Chips 125g", type: "OUT", qty: "-15", user: "clerk_sarah", time: "35 mins ago" },
  { id: 2, sku: "STA-014", product: "Ballpoint Pens (box of 50)", type: "OUT", qty: "-8", user: "clerk_sarah", time: "3 hours ago" },
  { id: 3, sku: "BEV-001", product: "Sparkling Mineral Water 500ml", type: "OUT", qty: "-24", user: "clerk_sarah", time: "Yesterday" },
]

type RequestStatus = "pending" | "approved" | "declined"

const REQUEST_STYLES: Record<RequestStatus, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  approved: "bg-green-500/10 text-green-600 dark:text-green-400",
  declined: "bg-muted text-muted-foreground",
}

const myRequests: {
  id: string
  item: string
  qty: string
  when: string
  status: RequestStatus
}[] = [
  { id: "REQ-021", item: "Energy Drink 500ml", qty: "2 cases", when: "Today", status: "pending" },
  { id: "REQ-019", item: "Receipt paper rolls", qty: "10 rolls", when: "Yesterday", status: "approved" },
  { id: "REQ-018", item: "Cleaning gloves", qty: "1 box", when: "Yesterday", status: "pending" },
  { id: "REQ-015", item: "Shelf labels", qty: "200 labels", when: "Monday", status: "declined" },
]

// Plain strings so the page never reads the clock during prerender.
// No status or prices: staff only see what is arriving and when.
const incoming = [
  { id: "PO-1001", supplier: "Acme Supplies", items: "24 boxes of widgets", due: "Today" },
  { id: "PO-1003", supplier: "Globex", items: "Packaging materials", due: "In 3 days" },
  { id: "PO-1009", supplier: "Hooli", items: "Shelving units", due: "In 5 days" },
]

export default function StaffDashboardPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Overview</h2>
          <p className="text-sm text-muted-foreground">
            Your requests, low stock and deliveries on the way.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="rounded-sm">
            <Link href="/staff/inventory">
              <Package /> Browse inventory
            </Link>
          </Button>
          <Button asChild className="rounded-sm">
            <Link href="/staff/requests">
              <Plus /> New request
            </Link>
          </Button>
        </div>
      </div>

      <KpiStrip items={stats} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="My requests"
          description="Items you have asked for"
          href="/staff/requests"
          linkLabel="All requests"
          className="lg:col-span-2"
        >
          <ul className="divide-y">
            {myRequests.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-muted">
                  <Inbox className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.item}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="font-mono">{r.id}</span> · {r.qty} · {r.when}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-medium capitalize",
                    REQUEST_STYLES[r.status]
                  )}
                >
                  <span className="size-1.5 rounded-full bg-current" />
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <LowStockPanel
          items={lowStock}
          href="/staff/inventory"
          linkLabel="View all 12"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ActivityPanel
          title="My activity"
          description="Your latest stock changes"
          items={myActivity}
          href="/staff/inventory"
          linkLabel="Inventory"
          className="lg:col-span-2"
        />

        <Panel
          title="Incoming deliveries"
          description="What is arriving soon"
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
                    {o.items}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-xs",
                    o.due === "Today"
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {o.due}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  )
}