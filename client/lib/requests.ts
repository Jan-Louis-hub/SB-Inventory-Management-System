import { findProduct } from "@/lib/inventory"

export type RequestStatus = "pending" | "approved" | "declined" | "fulfilled"

export type StockRequest = {
  id: string
  sku: string
  qty: number
  note: string
  when: string
  status: RequestStatus
  requester: string
}

// Amahle's reorder requests from the women's floor.
const REQUESTS: StockRequest[] = [
  {
    id: "REQ-214",
    sku: "TOP-052",
    qty: 6,
    note: "Three left on the rail and two customers asked us to hold one.",
    when: "Today",
    status: "pending",
    requester: "Amahle Dlamini",
  },
  {
    id: "REQ-211",
    sku: "ACC-013",
    qty: 12,
    note: "The window tote is gone. We need a full dozen for the display.",
    when: "Yesterday",
    status: "approved",
    requester: "Amahle Dlamini",
  },
  {
    id: "REQ-209",
    sku: "KID-018",
    qty: 8,
    note: "Khaki shorts are down to the last sizes before the school holidays.",
    when: "Yesterday",
    status: "pending",
    requester: "Amahle Dlamini",
  },
  {
    id: "REQ-204",
    sku: "DRS-014",
    qty: 4,
    note: "Asked for four floral wraps. The supplier cannot split a carton this week.",
    when: "Monday",
    status: "declined",
    requester: "Amahle Dlamini",
  },
  {
    id: "REQ-198",
    sku: "KNT-004",
    qty: 6,
    note: "Oat merino for the front table. Received with the knit delivery.",
    when: "Last week",
    status: "fulfilled",
    requester: "Amahle Dlamini",
  },
  {
    id: "REQ-191",
    sku: "FTW-009",
    qty: 8,
    note: "White sneakers in the smaller sizes.",
    when: "Last week",
    status: "fulfilled",
    requester: "Amahle Dlamini",
  },
]

export function getRequests() {
  return REQUESTS.map((request) => ({ ...request }))
}

export function getRequestSnapshot() {
  const open = REQUESTS.filter(
    (request) => request.status === "pending" || request.status === "approved"
  )
  return {
    open: open.length,
    approved: open.filter((request) => request.status === "approved").length,
  }
}

export function getRequestPreview() {
  return REQUESTS.filter(
    (
      request
    ): request is StockRequest & {
      status: "pending" | "approved" | "declined"
    } => request.status !== "fulfilled"
  ).map((request) => ({
    id: request.id,
    item: findProduct(request.sku)?.name ?? request.sku,
    qty: `${request.qty} units`,
    when: request.when,
    status: request.status,
  }))
}
