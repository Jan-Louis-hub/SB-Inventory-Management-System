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
  cost?: number // unit cost, only kept for roles that may see prices
}

export type InventoryAction = "adjust" | "request"

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

// Placeholder data. Replace with a fetch that your backend already filters by role.
const MOCK: (Product & { cost: number })[] = [
  { id: "1", sku: "BEV-001", name: "Sparkling Mineral Water 500ml", category: "Beverages", location: "Aisle 4", unit: "units", stock: 240, min: 100, cost: 8 },
  { id: "2", sku: "BEV-042", name: "Energy Drink 500ml", category: "Beverages", location: "Aisle 4", unit: "units", stock: 4, min: 15, cost: 22 },
  { id: "3", sku: "BEV-018", name: "Orange Juice 1L", category: "Beverages", location: "Aisle 4", unit: "units", stock: 38, min: 30, cost: 19 },
  { id: "4", sku: "SNK-001", name: "Artisanal Potato Chips 125g", category: "Snacks", location: "Aisle 3", unit: "units", stock: 64, min: 40, cost: 14 },
  { id: "5", sku: "SNK-112", name: "Organic Protein Bar 60g", category: "Snacks", location: "Aisle 3", unit: "units", stock: 6, min: 20, cost: 18 },
  { id: "6", sku: "SNK-045", name: "Salted Peanuts 250g", category: "Snacks", location: "Aisle 3", unit: "units", stock: 0, min: 25, cost: 21 },
  { id: "7", sku: "STA-001", name: "A4 Hardcover Notebook 192p", category: "Stationery", location: "Aisle 1", unit: "units", stock: 8, min: 10, cost: 35 },
  { id: "8", sku: "STA-014", name: "Ballpoint Pens (box of 50)", category: "Stationery", location: "Aisle 1", unit: "boxes", stock: 22, min: 10, cost: 60 },
  { id: "9", sku: "STA-020", name: "Heavy Duty Stapler", category: "Stationery", location: "Aisle 1", unit: "units", stock: 15, min: 5, cost: 85 },
  { id: "10", sku: "HSE-003", name: "Dish Soap 750ml", category: "Household", location: "Aisle 6", unit: "units", stock: 9, min: 12, cost: 32 },
  { id: "11", sku: "HSE-010", name: "Laundry Powder 2kg", category: "Household", location: "Aisle 6", unit: "units", stock: 31, min: 20, cost: 78 },
  { id: "12", sku: "HSE-021", name: "Paper Towels 6 pack", category: "Household", location: "Aisle 6", unit: "packs", stock: 5, min: 12, cost: 45 },
  { id: "13", sku: "FRZ-004", name: "Frozen Peas 1kg", category: "Frozen", location: "Freezer 2", unit: "units", stock: 44, min: 24, cost: 29 },
  { id: "14", sku: "FRZ-009", name: "Ice Cream 2L", category: "Frozen", location: "Freezer 2", unit: "units", stock: 12, min: 18, cost: 52 },
  { id: "15", sku: "DRY-002", name: "Basmati Rice 2kg", category: "Dry goods", location: "Back store", unit: "bags", stock: 52, min: 30, cost: 48 },
  { id: "16", sku: "DRY-017", name: "Pasta Spirals 500g", category: "Dry goods", location: "Back store", unit: "units", stock: 3, min: 20, cost: 15 },
  { id: "17", sku: "DRY-030", name: "Olive Oil 750ml", category: "Dry goods", location: "Back store", unit: "units", stock: 17, min: 15, cost: 98 },
]

export function getProductsForRole(role: Role): Product[] {
  const { showCost } = INVENTORY_VIEW[role]
  // Prices are removed here, so roles that shouldn't see them never receive them
  return MOCK.map(({ cost, ...rest }) => (showCost ? { ...rest, cost } : rest))
}