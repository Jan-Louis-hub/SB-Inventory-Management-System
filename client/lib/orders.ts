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

const ORDERS: (Order & { total: number })[] = []

const CONTROLLER_QUEUE: { id: string; due: string }[] = []

const STAFF_QUEUE: { id: string; due: string }[] = []

function orderById(id: string) {
  const order = ORDERS.find((o) => o.id === id)
  if (!order) throw new Error(`Missing order ${id}`)
  return order
}

export function getOrdersForRole(role: OrderRole): Order[] {
  const view = ORDER_VIEW[role]
  return ORDERS.filter((o) => view.statuses.includes(o.status)).map(
    ({ total, ...rest }) => (view.showTotal ? { ...rest, total } : rest)
  )
}

export function getOrderSnapshot() {
  let open = 0
  let pending = 0
  let delayed = 0
  let toCheckIn = 0

  for (const order of ORDERS) {
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
  return ORDERS.filter((o) => o.status === "pending").map((o) => ({
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
