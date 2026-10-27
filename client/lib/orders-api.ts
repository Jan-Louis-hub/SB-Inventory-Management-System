export type PurchaseOrderItem = {
  id: number
  product_id: number
  sku: string
  product_name: string
  quantity_ordered: number
  quantity_received: number
  unit_cost: string
  line_total: string
}

export type PurchaseOrder = {
  id: number
  purchase_number: string
  supplier_id: number
  supplier: string
  status: "draft" | "ordered" | "partial" | "received" | "cancelled"
  order_date: string
  expected_date: string | null
  total_amount: string
  items: PurchaseOrderItem[]
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

export async function listPurchaseOrders() {
  const result = await api<{ purchase_orders: PurchaseOrder[] }>("purchase-orders")
  return result.purchase_orders
}

export async function createPurchaseOrder(input: {
  supplier_id: number
  expected_date?: string
  items: { product_id: number; quantity_ordered: number }[]
}) {
  return api<{ purchase_order: PurchaseOrder }>("purchase-orders", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function receivePurchaseOrderItem(
  orderId: number,
  itemId: number,
  quantity: number
) {
  return api<{ purchase_order: PurchaseOrder }>(
    `purchase-orders/${orderId}/items/${itemId}/receive`,
    { method: "POST", body: JSON.stringify({ quantity }) }
  )
}
