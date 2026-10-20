import { addDays } from "date-fns"
import type { Role } from "@/lib/roles"

export type DeliveryStatus = "scheduled" | "arrived" | "delayed" | "received"

export type Delivery = {
  id: string
  supplier: string
  items: string
  date: Date
  status: DeliveryStatus
  value?: number // only kept for roles that may see prices
}

type RawDelivery = Delivery & { visibleTo: Role[] }

// What each role sees. Change this to change who sees what.
export const ROLE_VIEW: Record<
  Role,
  {
    title: string
    statuses: DeliveryStatus[]
    showValue: boolean
    showStatus: boolean
    ordersHref?: string
  }
> = {
  inventory_manager: {
    title: "All deliveries",
    statuses: ["scheduled", "arrived", "delayed", "received"],
    showValue: true,
    showStatus: true,
    ordersHref: "/manager/orders",
  },
  stock_controller: {
    title: "Deliveries to receive",
    statuses: ["scheduled", "arrived", "delayed"],
    showValue: false,
    showStatus: true,
    ordersHref: "/controller/orders",
  },
  staff_member: {
    title: "Incoming deliveries",
    statuses: ["scheduled", "arrived"],
    showValue: false,
    showStatus: false,
  },
}

// Placeholder data, relative to today so something always shows.
// Replace with a fetch to your backend that already filters by role.
function mockDeliveries(): RawDelivery[] {
  const today = new Date()
  const all: Role[] = ["inventory_manager", "stock_controller", "staff_member"]
  const ops: Role[] = ["inventory_manager", "stock_controller"]

  return [
    { id: "0", supplier: "Initech", items: "8 crates of parts", date: addDays(today, -2), status: "received", value: 3200, visibleTo: ops },
    { id: "1", supplier: "Acme Supplies", items: "24 boxes of widgets", date: addDays(today, 1), status: "scheduled", value: 12400, visibleTo: all },
    { id: "2", supplier: "FreshCo", items: "10 pallets of stock", date: addDays(today, 3), status: "scheduled", value: 8900, visibleTo: ops },
    { id: "3", supplier: "Globex", items: "Packaging materials", date: addDays(today, 3), status: "delayed", value: 1750, visibleTo: all },
    { id: "4", supplier: "Initech", items: "6 crates of parts", date: addDays(today, 8), status: "scheduled", value: 5100, visibleTo: ops },
  ]
}

export function getDeliveriesForRole(role: Role): Delivery[] {
  const view = ROLE_VIEW[role]

  return mockDeliveries()
    .filter((d) => d.visibleTo.includes(role) && view.statuses.includes(d.status))
    .map(({ visibleTo, value, ...rest }) => ({
      ...rest,
      // Prices are removed for roles that shouldn't see them
      ...(view.showValue ? { value } : {}),
    }))
}