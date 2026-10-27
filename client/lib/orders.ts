import { money } from "@/lib/format"
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

// Purchase orders for Harbour Lane. Dates sit in the week of 26 Oct 2026,
// which is the shop scenario the overview screens describe.
// Replace with a fetch that your backend already filters by role.
const MOCK: (Order & { total: number })[] = [
  { id: "PO-1041", supplier: "Cape Cloth Co.", items: "24 Ivory Silk Blouses, 18 Sand Slip Dresses", expected: "2026-10-26", status: "shipped", total: 15240 },
  { id: "PO-1042", supplier: "Highveld Denim", items: "30 Black High-rise Jeans, 12 Camel Trench Coats", expected: "2026-10-24", status: "delayed", total: 19320 },
  { id: "PO-1043", supplier: "Karoo Knitwear", items: "16 Camel Cashmere Cardigans", expected: "2026-10-29", status: "approved", total: 14720 },
  { id: "PO-1044", supplier: "Sole & Stitch", items: "20 White Canvas Sneakers, 40 Natural Canvas Totes", expected: "2026-11-02", status: "pending", total: 13000 },
  { id: "PO-1045", supplier: "Little Thread", items: "24 Khaki Kids Chino Shorts", expected: "2026-10-20", status: "received", total: 3840 },
  { id: "PO-1046", supplier: "Cape Cloth Co.", items: "36 Black Cotton Tees", expected: "2026-11-06", status: "pending", total: 3204 },
  { id: "PO-1047", supplier: "Highveld Denim", items: "10 Navy Pleated Midi Skirts", expected: "2026-10-12", status: "cancelled", total: 2650 },
  { id: "PO-1048", supplier: "Sole & Stitch", items: "15 Tan Leather Loafers", expected: "2026-10-31", status: "approved", total: 8100 },
  { id: "PO-1049", supplier: "Karoo Knitwear", items: "20 Oat Merino Crew Knits", expected: "2026-11-04", status: "pending", total: 7600 },
]

const CONTROLLER_QUEUE: { id: string; due: string }[] = [
  { id: "PO-1041", due: "Today" },
  { id: "PO-1042", due: "2 days overdue" },
  { id: "PO-1043", due: "In 3 days" },
  { id: "PO-1048", due: "In 5 days" },
]

const STAFF_QUEUE: { id: string; due: string }[] = [
  { id: "PO-1041", due: "Today" },
  { id: "PO-1043", due: "In 3 days" },
  { id: "PO-1048", due: "In 5 days" },
]

function orderById(id: string) {
  const order = MOCK.find((o) => o.id === id)
  if (!order) throw new Error(`Missing order ${id}`)
  return order
}

export function getOrdersForRole(role: OrderRole): Order[] {
  const view = ORDER_VIEW[role]
  return MOCK.filter((o) => view.statuses.includes(o.status)).map(
    ({ total, ...rest }) => (view.showTotal ? { ...rest, total } : rest)
  )
}

export function getOrderSnapshot() {
  let open = 0
  let pending = 0
  let delayed = 0
  let toCheckIn = 0

  for (const order of MOCK) {
    if (order.status !== "received" && order.status !== "cancelled") open += 1
    if (order.status === "pending") pending += 1
    if (order.status === "delayed") delayed += 1
    if (
      order.status === "approved" ||
      order.status === "shipped" ||
      order.status === "delayed"
    ) {
      toCheckIn += 1
    }
  }

  return { open, pending, delayed, toCheckIn }
}

export function getPendingApprovals() {
  return MOCK.filter((o) => o.status === "pending").map((o) => ({
    id: o.id,
    supplier: o.supplier,
    items: o.items,
    total: money.format(o.total),
  }))
}

export function getControllerIncoming() {
  return CONTROLLER_QUEUE.map(({ id, due }) => {
    const order = orderById(id)
    if (
      order.status !== "approved" &&
      order.status !== "shipped" &&
      order.status !== "delayed"
    ) {
      throw new Error(`Order ${id} is not incoming`)
    }
    return {
      id: order.id,
      supplier: order.supplier,
      items: order.items,
      due,
      status: order.status,
    }
  })
}

export function getStaffIncoming() {
  return STAFF_QUEUE.map(({ id, due }) => {
    const order = orderById(id)
    return {
      id: order.id,
      supplier: order.supplier,
      items: order.items,
      due,
    }
  })
}
