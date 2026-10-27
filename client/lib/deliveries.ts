import type { Role } from "@/lib/roles"

export type DeliveryStatus = "scheduled" | "arrived" | "delayed" | "received"
export type Delivery = {
  id: string
  supplier: string
  items: string
  date: Date
  status: DeliveryStatus
  value?: number
}

export const ROLE_VIEW: Record<Role, {
  title: string
  statuses: DeliveryStatus[]
  showValue: boolean
  showStatus: boolean
  ordersHref?: string
}> = {
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
