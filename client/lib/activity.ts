export type StockMovement = {
  id: number
  sku: string
  product: string
  type: "IN" | "OUT"
  qty: string
  user: string
  time: string
}

const MOVEMENTS: StockMovement[] = []

export function allMovements() {
  return MOVEMENTS.map((movement) => ({ ...movement }))
}

export function movementsFor(view: "manager" | "controller" | "staff") {
  if (view === "manager") return allMovements().slice(0, 5)
  if (view === "controller") return allMovements().slice(0, 4)
  return allMovements()
}
