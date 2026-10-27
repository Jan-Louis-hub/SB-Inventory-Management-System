import type { Role } from "@/lib/roles"

export type StockLevel = "in_stock" | "low" | "critical" | "out"

export type Product = {
  id: string
  sku: string
  name: string
  category: string
  location: string
  unit: string
  stock: number
  min: number
  supplier: string
  cost?: number // unit cost, only kept for roles that may see prices
}

export type InventoryAction = "adjust" | "request"

export const LOCATIONS = [
  "Women's floor",
  "Men's floor",
  "Kids corner",
  "Window",
  "Back room",
] as const

export const INVENTORY_VIEW: Record<
  Role,
  {
    title: string
    description: string
    showCost: boolean
    actions: InventoryAction[]
  }
> = {
  inventory_manager: {
    title: "Inventory",
    description: "Every product, its stock level and what it is worth.",
    showCost: true,
    actions: ["adjust"],
  },
  stock_controller: {
    title: "Stock",
    description: "Check stock levels and record stock in and out.",
    showCost: false,
    actions: ["adjust"],
  },
  staff_member: {
    title: "Inventory",
    description: "Look up what is in stock and where to find it.",
    showCost: false,
    actions: ["request"],
  },
}

export function getLevel(p: Pick<Product, "stock" | "min">): StockLevel {
  if (p.stock === 0) return "out"
  if (p.stock < p.min * 0.5) return "critical"
  if (p.stock < p.min) return "low"
  return "in_stock"
}

const PRODUCTS: (Product & { cost: number })[] = []

export function findProduct(sku: string) {
  return PRODUCTS.find((p) => p.sku === sku)
}

export function getProductsForRole(role: Role): Product[] {
  const { showCost } = INVENTORY_VIEW[role]
  return PRODUCTS.map(({ cost, ...rest }) => (showCost ? { ...rest, cost } : rest))
}

export function getInventorySnapshot() {
  let critical = 0
  let out = 0
  let low = 0
  let units = 0
  let value = 0

  for (const product of PRODUCTS) {
    const level = getLevel(product)
    if (level === "critical") critical += 1
    else if (level === "out") out += 1
    else if (level === "low") low += 1
    units += product.stock
    value += product.stock * product.cost
  }

  return {
    products: PRODUCTS.length,
    categories: new Set(PRODUCTS.map((p) => p.category)).size,
    belowMin: critical + out + low,
    critical,
    out,
    low,
    units,
    value,
  }
}

export function getLowStockPreview(limit = 4) {
  return [...PRODUCTS]
    .filter((p) => getLevel(p) !== "in_stock")
    .sort(
      (a, b) => a.stock / a.min - b.stock / b.min || a.name.localeCompare(b.name)
    )
    .slice(0, limit)
    .map((p) => ({
      sku: p.sku,
      name: p.name,
      category: p.category,
      current: p.stock,
      min: p.min,
    }))
}

export function getCategoryBreakdown() {
  const rows = new Map<
    string,
    { styles: number; units: number; value: number; belowMin: number }
  >()

  for (const product of PRODUCTS) {
    const row = rows.get(product.category) ?? {
      styles: 0,
      units: 0,
      value: 0,
      belowMin: 0,
    }
    row.styles += 1
    row.units += product.stock
    row.value += product.stock * product.cost
    if (getLevel(product) !== "in_stock") row.belowMin += 1
    rows.set(product.category, row)
  }

  return [...rows.entries()]
    .map(([category, row]) => ({ category, ...row }))
    .sort((a, b) => b.value - a.value)
}
