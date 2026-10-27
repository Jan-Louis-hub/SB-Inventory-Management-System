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

const DELIVERIES: RawDelivery[] = []

export function getDeliveriesForRole(role: Role): Delivery[] {
  const view = ROLE_VIEW[role]
  const today = new Date()

  return DELIVERIES.filter(
    (delivery) =>
      delivery.visibleTo.includes(role) && view.statuses.includes(delivery.status)
  ).map((delivery) => ({
    id: delivery.id,
    supplier: delivery.supplier,
    items: delivery.items,
    status: delivery.status,
    date: addDays(today, delivery.dayOffset),
    ...(view.showValue ? { value: delivery.value } : {}),
  }))
}
