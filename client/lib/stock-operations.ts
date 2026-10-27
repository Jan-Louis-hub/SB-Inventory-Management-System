export type StockCountLine = {
  id: number
  product_id: number
  sku: string
  name: string
  expected_quantity: number
  counted_quantity: number | null
}

export type StockCount = {
  id: number
  count_number: string
  area: string
  location: string
  due_label: string
  status: "scheduled" | "in_progress" | "completed"
  owner_user_id: number
  owner: string | null
  lines?: StockCountLine[]
}

export type StockRequest = {
  id: number
  request_number: string
  product_id: number
  sku: string
  product: string
  quantity: number
  note: string
  status: "pending" | "approved" | "declined" | "fulfilled"
  requester_user_id: number
  requester: string
  created_at: string
  resolved_at: string | null
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/inventory/${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error ?? "Could not complete the request")
  return result
}

export async function listStockCounts() {
  const result = await api<{ stock_counts: StockCount[] }>("stock-counts")
  return result.stock_counts
}

export async function createStockCount(input: {
  area: string
  location: string
  due_label: string
}) {
  const result = await api<{ stock_count: StockCount }>("stock-counts", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return result.stock_count
}

export async function getStockCount(countId: number) {
  const result = await api<{ stock_count: StockCount }>(`stock-counts/${countId}`)
  return result.stock_count
}

export async function updateStockCountLine(
  countId: number,
  lineId: number,
  counted_quantity: number | null
) {
  const result = await api<{ stock_count: StockCount }>(
    `stock-counts/${countId}/lines/${lineId}`,
    { method: "PATCH", body: JSON.stringify({ counted_quantity }) }
  )
  return result.stock_count
}

export async function completeStockCount(countId: number) {
  const result = await api<{ stock_count: StockCount }>(
    `stock-counts/${countId}/complete`,
    { method: "POST", body: JSON.stringify({}) }
  )
  return result.stock_count
}

export async function listStockRequests() {
  const result = await api<{ stock_requests: StockRequest[] }>("stock-requests")
  return result.stock_requests
}

export async function createStockRequest(input: {
  product_id: number
  quantity: number
  note: string
}) {
  const result = await api<{ stock_request: StockRequest }>("stock-requests", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return result.stock_request
}

export async function resolveStockRequest(
  requestId: number,
  action: "approve" | "decline" | "fulfill"
) {
  const result = await api<{ stock_request: StockRequest }>(
    `stock-requests/${requestId}/${action}`,
    { method: "POST", body: JSON.stringify({}) }
  )
  return result.stock_request
}

export async function withdrawStockRequest(requestId: number) {
  const response = await fetch(`/api/inventory/stock-requests/${requestId}`, {
    method: "DELETE",
    cache: "no-store",
  })
  if (!response.ok) {
    const result = await response.json().catch(() => ({}))
    throw new Error(result.error ?? "Could not withdraw stock request")
  }
}
