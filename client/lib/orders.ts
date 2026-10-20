import type { Role } from "@/lib/roles"

export type OrderStatus =
  | "pending"
  | "approved"
  | "shipped"
  | "delayed"
  | "received"
  | "cancelled"

export type Order = {
  id: string
  supplier: string
  items: string
  expected: string // ISO date
  status: OrderStatus
  total?: number
}

export type OrderRole = Exclude<Role, "staff_member">

type Action = { label: string; to: OrderStatus }

export const ORDER_VIEW: Record<
  OrderRole,
  {
    title: string
    description: string
    statuses: OrderStatus[]
    showTotal: boolean
    actions: Partial<Record<OrderStatus, Action[]>>
  }
> = {
  inventory_manager: {
    title: "Orders",
    description: "Approve, track and cancel supplier orders.",
    statuses: ["pending", "approved", "shipped", "delayed", "received", "cancelled"],
    showTotal: true,
    actions: {
      pending: [
        { label: "Approve", to: "approved" },
        { label: "Cancel", to: "cancelled" },
      ],
      approved: [{ label: "Cancel", to: "cancelled" }],
    },
  },
  stock_controller: {
    title: "Orders",
    description: "Incoming orders to check in when they arrive.",
    statuses: ["approved", "shipped", "delayed", "received"],
    showTotal: false,
    actions: {
      approved: [{ label: "Mark received", to: "received" }],
      shipped: [{ label: "Mark received", to: "received" }],
      delayed: [{ label: "Mark received", to: "received" }],
    },
  },
}

// Placeholder data. Replace with a fetch that your backend already filters by role.
const MOCK: (Order & { total: number })[] = [
  { id: "PO-1001", supplier: "Acme Supplies", items: "24 boxes of widgets", expected: "2026-10-21", status: "shipped", total: 12400 },
  { id: "PO-1002", supplier: "FreshCo", items: "10 pallets of stock", expected: "2026-10-23", status: "approved", total: 8900 },
  { id: "PO-1003", supplier: "Globex", items: "Packaging materials", expected: "2026-10-23", status: "delayed", total: 1750 },
  { id: "PO-1004", supplier: "Initech", items: "6 crates of parts", expected: "2026-10-28", status: "pending", total: 5100 },
  { id: "PO-1005", supplier: "Initech", items: "8 crates of parts", expected: "2026-10-18", status: "received", total: 3200 },
  { id: "PO-1006", supplier: "Umbrella Co", items: "Cleaning supplies", expected: "2026-10-30", status: "pending", total: 640 },
  { id: "PO-1007", supplier: "Hooli", items: "Shelving units", expected: "2026-10-15", status: "cancelled", total: 2300 },
]

export function getOrdersForRole(role: OrderRole): Order[] {
  const view = ORDER_VIEW[role]
  return MOCK.filter((o) => view.statuses.includes(o.status)).map(
    ({ total, ...rest }) => (view.showTotal ? { ...rest, total } : rest)
  )
}