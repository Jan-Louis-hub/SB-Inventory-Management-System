import type { Role } from "@/lib/roles"

export type StockLevel = "in_stock" | "low" | "critical" | "out"

export type Product = {
  id: string
  sku: string
  name: string
  category: string
  categoryId?: number | null
  supplierId?: number | null
  location: string
  unit: string
  stock: number
  min: number
  supplier: string
  cost?: number // unit cost, only kept for roles that may see prices
  active?: boolean
}

export type InventoryAction = "adjust"

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
    actions: [],
  },
}

export function getLevel(p: Pick<Product, "stock" | "min">): StockLevel {
  if (p.stock === 0) return "out"
  if (p.stock < p.min * 0.5) return "critical"
  if (p.stock < p.min) return "low"
  return "in_stock"
}
