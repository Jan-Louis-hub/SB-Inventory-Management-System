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

const REQUESTS: StockRequest[] = []

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
