export type StockMovement = {
  id: number
  sku: string
  product: string
  type: "IN" | "OUT"
  qty: string
  user: string
  time: string
}

// Newest first. Names match the Harbour Lane team in lib/staff.ts.
const MOVEMENTS: StockMovement[] = [
  { id: 1, sku: "TOP-014", product: "Black Cotton Tee", type: "IN", qty: "+12", user: "Thandi Mahlangu", time: "10 mins ago" },
  { id: 2, sku: "DRS-006", product: "Sand Linen Slip Dress", type: "OUT", qty: "-2", user: "Amahle Dlamini", time: "35 mins ago" },
  { id: 3, sku: "BTM-011", product: "Mid-wash Straight Jean", type: "IN", qty: "+6", user: "James Nkosi", time: "2 hours ago" },
  { id: 4, sku: "OUT-003", product: "Charcoal Wool Overcoat", type: "OUT", qty: "-1", user: "Amahle Dlamini", time: "3 hours ago" },
  { id: 5, sku: "ACC-007", product: "Rust Wool Scarf", type: "IN", qty: "+4", user: "James Nkosi", time: "Yesterday" },
  { id: 6, sku: "FTW-016", product: "Black Ankle Boot", type: "OUT", qty: "-1", user: "Amahle Dlamini", time: "Yesterday" },
  { id: 7, sku: "KNT-018", product: "Grey Cotton Hoodie", type: "OUT", qty: "-3", user: "Lerato Molefe", time: "Yesterday" },
  { id: 8, sku: "TOP-061", product: "White Oxford Shirt", type: "IN", qty: "+8", user: "Thandi Mahlangu", time: "Yesterday" },
  { id: 9, sku: "KID-011", product: "Stripe Kids Cotton Tee", type: "OUT", qty: "-5", user: "Lerato Molefe", time: "2 days ago" },
  { id: 10, sku: "ACC-001", product: "Brown Leather Belt", type: "OUT", qty: "-2", user: "Sipho Khumalo", time: "2 days ago" },
  { id: 11, sku: "DRS-022", product: "Olive Shirt Dress", type: "IN", qty: "+4", user: "James Nkosi", time: "3 days ago" },
  { id: 12, sku: "FTW-009", product: "White Canvas Sneaker", type: "OUT", qty: "-2", user: "Lerato Molefe", time: "3 days ago" },
]

export function allMovements() {
  return MOVEMENTS.map((movement) => ({ ...movement }))
}

export function movementsFor(view: "manager" | "controller" | "staff") {
  if (view === "manager") return allMovements().slice(0, 5)
  if (view === "controller") {
    return allMovements()
      .filter(
        (movement) =>
          movement.user === "James Nkosi" || movement.user === "Amahle Dlamini"
      )
      .slice(0, 4)
  }
  return allMovements().filter((movement) => movement.user === "Amahle Dlamini")
}
