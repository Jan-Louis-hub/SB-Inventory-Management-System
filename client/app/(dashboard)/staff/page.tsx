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
import { movementsFor } from "@/lib/activity"
import { getInventorySnapshot, getLowStockPreview } from "@/lib/inventory"
import { getStaffIncoming } from "@/lib/orders"
import { getRequestPreview, getRequestSnapshot } from "@/lib/requests"

// No prices and no order statuses: staff members only see what they need.
const snap = getInventorySnapshot()
const requestSnap = getRequestSnapshot()
const lowStock: LowStockItem[] = getLowStockPreview()
const myActivity: Movement[] = movementsFor("staff")
const myRequests = getRequestPreview()
const incoming = getStaffIncoming()
const arrivingToday = incoming.filter((order) => order.due === "Today").length

const stats: Kpi[] = [
  { title: "Products", value: String(snap.products), note: "In the catalogue", tone: "neutral", icon: Package, href: "/staff/inventory" },
  { title: "Low stock", value: String(snap.belowMin), note: `${snap.critical} critical`, tone: snap.belowMin > 0 ? "bad" : "good", icon: AlertTriangle, href: "/staff/inventory", alert: snap.belowMin > 0 },
  { title: "My open requests", value: String(requestSnap.open), note: `${requestSnap.approved} approved`, tone: "good", icon: Inbox, href: "/staff/requests" },
  { title: "Arriving this week", value: String(incoming.length), note: arrivingToday === 1 ? "1 today" : `${arrivingToday} today`, tone: "neutral", icon: Truck, href: "/staff" },
]

type RequestStatus = "pending" | "approved" | "declined"

const REQUEST_STYLES: Record<RequestStatus, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  approved: "bg-green-500/10 text-green-600 dark:text-green-400",
  declined: "bg-muted text-muted-foreground",
}

export const instant = false

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
          linkLabel={`View all ${snap.belowMin}`}
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