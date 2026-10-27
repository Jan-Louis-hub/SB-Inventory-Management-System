import type { Product } from "@/lib/inventory"
import { getSuppliers } from "@/lib/suppliers"

export type Category = {
  id: number
  name: string
  description: string | null
  product_count: number
}

export type StockMovementRecord = {
  id: number
  product_id: number
  product_name: string
  actor: string | null
  movement_type: string
  quantity_change: number
  reason: string
  created_at: string
}

type ApiProduct = {
  id: number
  sku: string
  name: string
  description: string | null
  category_id: number | null
  supplier_id: number | null
  category: { id: number; name: string } | null
  cost_price: string
  selling_price: string
  quantity: number
  location: string | null
  unit: string
  reorder_level: number
  is_active: boolean
}

type ApiResponse<T> = T & { error?: string }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/inventory/${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  })
  const result = (await response.json().catch(() => ({}))) as ApiResponse<T>
  if (!response.ok) {
    throw new Error(result.error ?? "The request could not be completed")
  }
  return result
}

function toProduct(
  product: ApiProduct,
  supplierNames: Map<number, string>
): Product {
  return {
    id: String(product.id),
    sku: product.sku,
    name: product.name,
    category: product.category?.name ?? "Uncategorized",
    categoryId: product.category_id,
    supplierId: product.supplier_id,
    stock: product.quantity,
    min: product.reorder_level,
    cost: Number(product.cost_price),
    location: product.location ?? "",
    unit: product.unit,
    supplier: product.supplier_id ? supplierNames.get(product.supplier_id) ?? "" : "",
    active: product.is_active,
  }
}

export async function listInventory() {
  const [productResponse, categoryResponse, suppliers] = await Promise.all([
    request<{
      products: ApiProduct[]
      pagination: { pages: number }
    }>("products?is_active=true&per_page=100&page=1"),
    request<{ categories: Category[] }>("categories"),
    getSuppliers(),
  ])
  const allProducts = [...productResponse.products]
  for (let page = 2; page <= productResponse.pagination.pages; page += 1) {
    const result = await request<{ products: ApiProduct[] }>(
      `products?is_active=true&per_page=100&page=${page}`
    )
    allProducts.push(...result.products)
  }
  const supplierNames = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]))
  return {
    products: allProducts.map((product) => toProduct(product, supplierNames)),
    categories: categoryResponse.categories,
    suppliers,
  }
}

export async function createCategory(input: {
  name: string
  description?: string
}) {
  return request<{ category: Category }>("categories", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function createProduct(input: {
  sku: string
  name: string
  description?: string
  category_id: number | null
  supplier_id: number | null
  location: string | null
  unit: string
  cost_price: string
  selling_price: string
  quantity: number
  reorder_level: number
}) {
  const result = await request<{ product: ApiProduct }>("products", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return toProduct(result.product, new Map())
}

export async function archiveProduct(productId: number) {
  const result = await request<{ product: ApiProduct }>(`products/${productId}/archive`, {
    method: "POST",
    body: JSON.stringify({}),
  })
  return toProduct(result.product, new Map())
}

export async function recordStockMovement(input: {
  product_id: number
  movement_type: "stock_in" | "stock_out"
  quantity: number
  reason: string
}) {
  await request("stock-movements", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function listStockMovements() {
  const result = await request<{ stock_movements: StockMovementRecord[] }>(
    "stock-movements?per_page=100"
  )
  return result.stock_movements
}
