import { getProductsForRole } from "@/lib/inventory"

export type CountStatus = "scheduled" | "in_progress" | "completed"

export type StockCount = {
  id: string
  area: string
  location: string
  due: string
  status: CountStatus
  owner: string
  counted: Record<string, number>
}

export type CountLine = {
  sku: string
  name: string
  category: string
  expected: number
  counted: number | null
}

const COUNTS: StockCount[] = []

export function countLines(
  location: string,
  counted: Record<string, number>
): CountLine[] {
  return getProductsForRole("stock_controller")
    .filter((product) => product.location === location)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((product) => ({
      sku: product.sku,
      name: product.name,
      category: product.category,
      expected: product.stock,
      counted: product.sku in counted ? counted[product.sku] : null,
    }))
}

export function countProgress(location: string, counted: Record<string, number>) {
  const lines = countLines(location, counted)
  const done = lines.filter((line) => line.counted !== null).length
  const variance = lines.reduce((sum, line) => {
    if (line.counted === null) return sum
    return sum + (line.counted - line.expected)
  }, 0)
  const short = lines.reduce((sum, line) => {
    if (line.counted === null || line.counted >= line.expected) return sum
    return sum + (line.expected - line.counted)
  }, 0)

  return {
    styles: lines.length,
    units: lines.reduce((sum, line) => sum + line.expected, 0),
    done,
    progress: lines.length === 0 ? 0 : Math.round((done / lines.length) * 100),
    variance,
    short,
  }
}

export function getCounts() {
  return COUNTS.map((count) => ({ ...count, counted: { ...count.counted } }))
}

export function getUpcomingCounts() {
  return COUNTS.filter((count) => count.status !== "completed").map((count) => {
    const progress = countProgress(count.location, count.counted)
    return {
      area: count.area,
      items: progress.units,
      due: count.due,
      progress: progress.progress,
    }
  })
}

export function getScheduledCountSummary() {
  const scheduled = COUNTS.filter((count) => count.status === "scheduled")
  const next = scheduled[0]
  return {
    due: scheduled.length,
    note: next ? `${next.area} is ${next.due.toLowerCase()}` : "None scheduled",
  }
}
