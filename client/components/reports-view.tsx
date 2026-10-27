"use client"

import * as React from "react"
import { AlertTriangle, ArrowLeftRight, Download, Package, Wallet } from "lucide-react"

import { DataTable, EmptyState, type Column } from "@/components/data/data-table"
import { FilterChips } from "@/components/data/filter-chips"
import { PageHeader } from "@/components/data/page-header"
import { TablePagination, usePagination } from "@/components/data/pagination"
import { StatusBadge } from "@/components/data/status-badge"
import { KpiStrip, type Kpi } from "@/components/dashboard/kpi-strip"
import { Panel } from "@/components/panel"
import { StockFlowChart } from "@/components/stock-flow-chart"
import { Button } from "@/components/ui/button"
import { useSearchQuery } from "@/hooks/use-search-query"
import { listInventory, listStockMovements, type StockMovementRecord } from "@/lib/inventory-api"
import { listSales, type SaleRecord } from "@/lib/sales-api"
import { getLevel } from "@/lib/inventory"
import { money } from "@/lib/format"

type MoveFilter = "all" | "IN" | "OUT"
type ProductRow = Awaited<ReturnType<typeof listInventory>>["products"][number]

function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`
}

export function ReportsView() {
  const q = useSearchQuery()
  const [products, setProducts] = React.useState<ProductRow[]>([])
  const [movements, setMovements] = React.useState<StockMovementRecord[]>([])
  const [sales, setSales] = React.useState<SaleRecord[]>([])
  const [move, setMove] = React.useState<MoveFilter>("all")
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.all([listInventory(), listStockMovements(), listSales()])
        .then(([inventory, stockMovements, salesRows]) => {
          setProducts(inventory.products)
          setMovements(stockMovements)
          setSales(salesRows)
          setError("")
        })
        .catch((caught: unknown) =>
          setError(caught instanceof Error ? caught.message : "Could not load reports")
        )
        .finally(() => setLoading(false))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const units = products.reduce((sum, product) => sum + product.stock, 0)
  const value = products.reduce((sum, product) => sum + product.stock * (product.cost ?? 0), 0)
  const belowMinimum = products.filter((product) => getLevel(product) !== "in_stock").length
  const stats: Kpi[] = [
    { title: "Stock value", value: money.format(value), note: "At unit cost", tone: "neutral", icon: Wallet },
    { title: "Units on hand", value: String(units), note: `${products.length} active products`, tone: "neutral", icon: Package },
    { title: "Below minimum", value: String(belowMinimum), note: "Requires restocking", tone: belowMinimum ? "bad" : "good", icon: AlertTriangle, alert: belowMinimum > 0 },
    { title: "Ledger lines", value: String(movements.length), note: "Recorded stock movements", tone: "neutral", icon: ArrowLeftRight },
  ]

  const categoryRows = [...products.reduce((groups, product) => {
    const row = groups.get(product.category) ?? { category: product.category, styles: 0, units: 0, value: 0, belowMin: 0 }
    row.styles += 1
    row.units += product.stock
    row.value += product.stock * (product.cost ?? 0)
    if (getLevel(product) !== "in_stock") row.belowMin += 1
    groups.set(product.category, row)
    return groups
  }, new Map<string, { category: string; styles: number; units: number; value: number; belowMin: number }>()).values()]
    .sort((a, b) => b.value - a.value)

  const ledger = movements.filter((entry) => {
    const type = entry.quantity_change > 0 ? "IN" : "OUT"
    if (move !== "all" && type !== move) return false
    return !q || [entry.product_name, entry.actor ?? "", entry.reason, String(entry.product_id), type]
      .some((value) => value.toLowerCase().includes(q))
  })
  const pagination = usePagination(ledger, { resetKey: `${q}|${move}` })

  function exportCsv() {
    const header = ["SKU", "Product", "Category", "Stock", "Reorder level", "Unit cost", "Stock value"]
    const body = products.map((product) => [
      product.sku,
      product.name,
      product.category,
      product.stock,
      product.min,
      product.cost ?? 0,
      (product.cost ?? 0) * product.stock,
    ])
    const csv = [header, ...body].map((row) => row.map(csvCell).join(",")).join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "inventory-stock.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  const columns: Column<StockMovementRecord>[] = [
    { key: "when", header: "When", cell: (entry) => <span className="text-sm text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</span> },
    {
      key: "product",
      header: "Product",
      cell: (entry) => <div className="flex min-w-0 flex-col"><span className="truncate text-sm font-medium">{entry.product_name}</span><span className="font-mono text-xs text-muted-foreground">Product ID {entry.product_id}</span></div>,
    },
    {
      key: "type",
      header: "Movement",
      cell: (entry) => <StatusBadge tone={entry.quantity_change > 0 ? "success" : "warning"}>{entry.movement_type.replace("_", " ")}</StatusBadge>,
    },
    { key: "qty", header: "Qty", align: "right", cell: (entry) => <span className="text-sm font-medium tabular-nums">{entry.quantity_change > 0 ? "+" : ""}{entry.quantity_change}</span> },
    { key: "user", header: "Recorded by", cell: (entry) => <span className="text-sm">{entry.actor || "Unknown"}</span> },
    { key: "reason", header: "Reason", cell: (entry) => <span className="text-sm">{entry.reason}</span> },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Reports"
        description="Live inventory valuation, category totals and the recorded movement ledger."
        actions={<Button className="rounded-sm" onClick={exportCsv} disabled={loading || products.length === 0}><Download /> Export CSV</Button>}
      />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <KpiStrip items={stats} />
      <Panel title="Recent sales" description="Completed transactions saved to the database">
        {sales.length ? (
          <ul className="divide-y">
            {sales.slice(0, 5).map((sale) => (
              <li key={sale.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-medium">{sale.sale_number}</p>
                  <p className="truncate text-xs text-muted-foreground">{sale.items.map((item) => `${item.product_name} × ${item.quantity}`).join(", ")}</p>
                </div>
                <span className="text-sm font-medium tabular-nums">{money.format(Number(sale.total_amount))}</span>
              </li>
            ))}
          </ul>
        ) : <p className="p-4 text-sm text-muted-foreground">{loading ? "Loading sales…" : "No sales recorded yet."}</p>}
      </Panel>
      <div className="grid gap-4 lg:grid-cols-3">
        <StockFlowChart className="lg:col-span-2" />
        <Panel title="Value by category" description="At current unit cost, highest first">
          {categoryRows.length ? (
            <ul className="divide-y">
              {categoryRows.map((row) => (
                <li key={row.category} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.category}</p>
                    <p className="text-xs text-muted-foreground">{row.styles} products · {row.units} units{row.belowMin ? ` · ${row.belowMin} below min` : ""}</p>
                  </div>
                  <span className="text-sm font-medium tabular-nums">{money.format(row.value)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="p-4 text-sm text-muted-foreground">{loading ? "Loading category totals…" : "No inventory to summarize yet."}</p>}
        </Panel>
      </div>
      <div id="audit" className="flex scroll-mt-6 flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold">Movement ledger</h3>
          <p className="text-xs text-muted-foreground">Stock transactions recorded in the database.</p>
        </div>
        <FilterChips value={move} onChange={setMove} options={[
          { value: "all", label: "All", count: movements.length },
          { value: "IN", label: "Stock in", count: movements.filter((entry) => entry.quantity_change > 0).length },
          { value: "OUT", label: "Stock out", count: movements.filter((entry) => entry.quantity_change < 0).length },
        ]} />
        <DataTable
          columns={columns}
          rows={loading ? [] : pagination.pageItems}
          rowKey={(entry) => String(entry.id)}
          empty={<EmptyState icon={ArrowLeftRight} title={loading ? "Loading movements…" : error ? "Movement history unavailable" : "No stock movements yet"} description={loading ? "Loading the inventory ledger." : error ? "Check backend availability and try again." : "Real stock adjustments and receipts will appear here."} />}
          footer={!loading && ledger.length ? <TablePagination pagination={pagination} noun="entries" note={q ? `Search: “${q}”` : undefined} /> : undefined}
        />
      </div>
    </div>
  )
}
