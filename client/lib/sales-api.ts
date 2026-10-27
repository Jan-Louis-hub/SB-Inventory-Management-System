export type SaleRecord = {
  id: number
  sale_number: string
  status: string
  subtotal: string
  discount_amount: string
  tax_amount: string
  total_amount: string
  sold_at: string
  items: {
    product_id: number
    product_name: string
    sku: string
    quantity: number
    unit_price: string
    line_total: string
  }[]
}

export async function listSales() {
  const response = await fetch("/api/inventory/sales", { cache: "no-store" })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error ?? "Could not load sales")
  return result.sales as SaleRecord[]
}

export async function recordSale(input: {
  items: { product_id: number; quantity: number }[]
}) {
  const response = await fetch("/api/inventory/sales", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error ?? "Could not record sale")
  return result.sale as SaleRecord
}
