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

// Sample catalogue for Harbour Lane, a small Cape Town clothing shop.
// Replace with a fetch that your backend already filters by role.
const MOCK: (Product & { cost: number })[] = [
  { id: "1", sku: "TOP-014", name: "Black Cotton Tee", category: "Tops", location: "Women's floor", unit: "units", stock: 86, min: 24, cost: 89, supplier: "Cape Cloth Co." },
  { id: "2", sku: "TOP-021", name: "White Cotton Tee", category: "Tops", location: "Women's floor", unit: "units", stock: 42, min: 24, cost: 89, supplier: "Cape Cloth Co." },
  { id: "3", sku: "TOP-038", name: "Sage Linen Camp Shirt", category: "Tops", location: "Men's floor", unit: "units", stock: 18, min: 12, cost: 245, supplier: "Cape Cloth Co." },
  { id: "4", sku: "TOP-052", name: "Ivory Silk Blouse", category: "Tops", location: "Women's floor", unit: "units", stock: 3, min: 8, cost: 320, supplier: "Cape Cloth Co." },
  { id: "5", sku: "TOP-061", name: "White Oxford Shirt", category: "Tops", location: "Men's floor", unit: "units", stock: 27, min: 12, cost: 265, supplier: "Cape Cloth Co." },
  { id: "6", sku: "BTM-011", name: "Mid-wash Straight Jean", category: "Bottoms", location: "Women's floor", unit: "units", stock: 54, min: 20, cost: 310, supplier: "Highveld Denim" },
  { id: "7", sku: "BTM-019", name: "Black High-rise Jean", category: "Bottoms", location: "Women's floor", unit: "units", stock: 7, min: 16, cost: 340, supplier: "Highveld Denim" },
  { id: "8", sku: "BTM-027", name: "Stone Tailored Chino", category: "Bottoms", location: "Men's floor", unit: "units", stock: 31, min: 12, cost: 280, supplier: "Highveld Denim" },
  { id: "9", sku: "BTM-033", name: "Navy Pleated Midi Skirt", category: "Bottoms", location: "Women's floor", unit: "units", stock: 0, min: 8, cost: 265, supplier: "Highveld Denim" },
  { id: "10", sku: "DRS-006", name: "Sand Linen Slip Dress", category: "Dresses", location: "Women's floor", unit: "units", stock: 14, min: 6, cost: 420, supplier: "Cape Cloth Co." },
  { id: "11", sku: "DRS-014", name: "Floral Wrap Dress", category: "Dresses", location: "Women's floor", unit: "units", stock: 2, min: 6, cost: 480, supplier: "Cape Cloth Co." },
  { id: "12", sku: "DRS-022", name: "Olive Shirt Dress", category: "Dresses", location: "Window", unit: "units", stock: 9, min: 4, cost: 395, supplier: "Cape Cloth Co." },
  { id: "13", sku: "OUT-003", name: "Charcoal Wool Overcoat", category: "Outerwear", location: "Men's floor", unit: "units", stock: 6, min: 4, cost: 890, supplier: "Highveld Denim" },
  { id: "14", sku: "OUT-008", name: "Camel Trench Coat", category: "Outerwear", location: "Women's floor", unit: "units", stock: 4, min: 5, cost: 760, supplier: "Highveld Denim" },
  { id: "15", sku: "OUT-015", name: "Indigo Denim Jacket", category: "Outerwear", location: "Women's floor", unit: "units", stock: 22, min: 8, cost: 450, supplier: "Highveld Denim" },
  { id: "16", sku: "KNT-004", name: "Oat Merino Crew Knit", category: "Knitwear", location: "Women's floor", unit: "units", stock: 19, min: 10, cost: 380, supplier: "Karoo Knitwear" },
  { id: "17", sku: "KNT-012", name: "Camel Cashmere Cardigan", category: "Knitwear", location: "Back room", unit: "units", stock: 1, min: 4, cost: 920, supplier: "Karoo Knitwear" },
  { id: "18", sku: "KNT-018", name: "Grey Cotton Hoodie", category: "Knitwear", location: "Men's floor", unit: "units", stock: 36, min: 15, cost: 295, supplier: "Karoo Knitwear" },
  { id: "19", sku: "FTW-002", name: "Tan Leather Loafer", category: "Footwear", location: "Back room", unit: "units", stock: 11, min: 6, cost: 540, supplier: "Sole & Stitch" },
  { id: "20", sku: "FTW-009", name: "White Canvas Sneaker", category: "Footwear", location: "Men's floor", unit: "units", stock: 5, min: 10, cost: 360, supplier: "Sole & Stitch" },
  { id: "21", sku: "FTW-016", name: "Black Ankle Boot", category: "Footwear", location: "Women's floor", unit: "units", stock: 8, min: 6, cost: 680, supplier: "Sole & Stitch" },
  { id: "22", sku: "ACC-001", name: "Brown Leather Belt", category: "Accessories", location: "Back room", unit: "units", stock: 28, min: 10, cost: 180, supplier: "Sole & Stitch" },
  { id: "23", sku: "ACC-007", name: "Rust Wool Scarf", category: "Accessories", location: "Window", unit: "units", stock: 16, min: 8, cost: 220, supplier: "Sole & Stitch" },
  { id: "24", sku: "ACC-013", name: "Natural Canvas Tote", category: "Accessories", location: "Window", unit: "units", stock: 0, min: 12, cost: 145, supplier: "Sole & Stitch" },
  { id: "25", sku: "ACC-020", name: "Tortoise Sunglasses", category: "Accessories", location: "Window", unit: "units", stock: 13, min: 6, cost: 260, supplier: "Sole & Stitch" },
  { id: "26", sku: "KID-003", name: "Light-wash Kids Denim Jacket", category: "Outerwear", location: "Kids corner", unit: "units", stock: 17, min: 8, cost: 240, supplier: "Little Thread" },
  { id: "27", sku: "KID-011", name: "Stripe Kids Cotton Tee", category: "Tops", location: "Kids corner", unit: "units", stock: 44, min: 16, cost: 95, supplier: "Little Thread" },
  { id: "28", sku: "KID-018", name: "Khaki Kids Chino Short", category: "Bottoms", location: "Kids corner", unit: "units", stock: 6, min: 10, cost: 160, supplier: "Little Thread" },
]

export function findProduct(sku: string) {
  return MOCK.find((p) => p.sku === sku)
}

export function getProductsForRole(role: Role): Product[] {
  const { showCost } = INVENTORY_VIEW[role]
  // Prices are removed here, so roles that shouldn't see them never receive them
  return MOCK.map(({ cost, ...rest }) => (showCost ? { ...rest, cost } : rest))
}

export function getInventorySnapshot() {
  let critical = 0
  let out = 0
  let low = 0
  let units = 0
  let value = 0

  for (const product of MOCK) {
    const level = getLevel(product)
    if (level === "critical") critical += 1
    else if (level === "out") out += 1
    else if (level === "low") low += 1
    units += product.stock
    value += product.stock * product.cost
  }

  return {
    products: MOCK.length,
    categories: new Set(MOCK.map((p) => p.category)).size,
    belowMin: critical + out + low,
    critical,
    out,
    low,
    units,
    value,
  }
}

export function getLowStockPreview(limit = 4) {
  return [...MOCK]
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

  for (const product of MOCK) {
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
