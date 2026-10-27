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

type RawDelivery = Omit<Delivery, "date" | "value"> & {
  dayOffset: number
  value: number
  visibleTo: Role[]
}

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

// Same purchase orders as lib/orders.ts, dated from today so the calendar
// always has something to show. Replace with a fetch that already filters by role.
const MOCK: RawDelivery[] = [
  {
    id: "PO-1045",
    supplier: "Little Thread",
    items: "24 Khaki Kids Chino Shorts",
    dayOffset: -6,
    status: "received",
    value: 3840,
    visibleTo: ["inventory_manager", "stock_controller"],
  },
  {
    id: "PO-1042",
    supplier: "Highveld Denim",
    items: "30 Black High-rise Jeans, 12 Camel Trench Coats",
    dayOffset: -2,
    status: "delayed",
    value: 19320,
    visibleTo: ["inventory_manager", "stock_controller"],
  },
  {
    id: "PO-1041",
    supplier: "Cape Cloth Co.",
    items: "24 Ivory Silk Blouses, 18 Sand Slip Dresses",
    dayOffset: 0,
    status: "arrived",
    value: 15240,
    visibleTo: ["inventory_manager", "stock_controller", "staff_member"],
  },
  {
    id: "PO-1043",
    supplier: "Karoo Knitwear",
    items: "16 Camel Cashmere Cardigans",
    dayOffset: 3,
    status: "scheduled",
    value: 14720,
    visibleTo: ["inventory_manager", "stock_controller", "staff_member"],
  },
  {
    id: "PO-1048",
    supplier: "Sole & Stitch",
    items: "15 Tan Leather Loafers",
    dayOffset: 5,
    status: "scheduled",
    value: 8100,
    visibleTo: ["inventory_manager", "stock_controller", "staff_member"],
  },
]

export function getDeliveriesForRole(role: Role): Delivery[] {
  const view = ROLE_VIEW[role]
  const today = new Date()

  return MOCK.filter(
    (delivery) =>
      delivery.visibleTo.includes(role) && view.statuses.includes(delivery.status)
  ).map((delivery) => ({
    id: delivery.id,
    supplier: delivery.supplier,
    items: delivery.items,
    status: delivery.status,
    date: addDays(today, delivery.dayOffset),
    // Prices are removed for roles that shouldn't see them
    ...(view.showValue ? { value: delivery.value } : {}),
  }))
}
