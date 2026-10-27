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
import { allMovements, type StockMovement } from "@/lib/activity"
import { money } from "@/lib/format"
import {
  getCategoryBreakdown,
  getInventorySnapshot,
  getProductsForRole,
} from "@/lib/inventory"
type MoveFilter = "all" | "IN" | "OUT"

function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`
}

export function ReportsView() {
  const q = useSearchQuery()
  const snap = React.useMemo(() => getInventorySnapshot(), [])
  const categories = React.useMemo(() => getCategoryBreakdown(), [])
  const movements = React.useMemo(() => allMovements(), [])
  const [move, setMove] = React.useState<MoveFilter>("all")

  const stats: Kpi[] = [
    {
      title: "Stock value",
      value: money.format(snap.value),
      note: "At unit cost",
      tone: "neutral",
      icon: Wallet,
    },
    {
      title: "Units on hand",
      value: String(snap.units),
      note: `${snap.products} styles`,
      tone: "neutral",
      icon: Package,
    },
    {
      title: "Below minimum",
      value: String(snap.belowMin),
      note: `${snap.out} out of stock`,
      tone: snap.belowMin > 0 ? "bad" : "good",
      icon: AlertTriangle,
      alert: snap.belowMin > 0,
    },
    {
      title: "Ledger lines",
      value: String(movements.length),
      note: "Latest floor adjustments",
      tone: "neutral",
      icon: ArrowLeftRight,
    },
  ]

  const ledger = movements.filter((entry) => {
    if (move !== "all" && entry.type !== move) return false
    if (!q) return true
    return [entry.product, entry.sku, entry.user, entry.type, entry.time].some(
      (value) => value.toLowerCase().includes(q)
    )
  })

  const pagination = usePagination(ledger, { resetKey: `${q}|${move}` })

  function exportCsv() {
    const products = getProductsForRole("inventory_manager")
    const header = [
      "SKU",
      "Product",
      "Category",
      "Location",
      "Supplier",
      "Stock",
      "Minimum",
      "Unit cost (ZAR)",
      "Stock value (ZAR)",
    ]
    const body = products.map((product) => [
      product.sku,
      product.name,
      product.category,
      product.location,
      product.supplier,
      product.stock,
      product.min,
      product.cost ?? 0,
      (product.cost ?? 0) * product.stock,
    ])
    const csv = [header, ...body]
      .map((row) => row.map(csvCell).join(","))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "harbour-lane-stock.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  const columns: Column<StockMovement>[] = [
    {
      key: "when",
      header: "When",
      cell: (entry) => (
        <span className="text-sm text-muted-foreground">{entry.time}</span>
      ),
    },
    {
      key: "product",
      header: "Product",
      cell: (entry) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{entry.product}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {entry.sku}
          </span>
        </div>
      ),
    },
    {
      key: "type",
      header: "Movement",
      cell: (entry) => (
        <StatusBadge tone={entry.type === "IN" ? "success" : "warning"}>
          {entry.type === "IN" ? "Stock in" : "Stock out"}
        </StatusBadge>
      ),
    },
    {
      key: "qty",
      header: "Qty",
      align: "right",
      cell: (entry) => (
        <span className="text-sm font-medium tabular-nums">{entry.qty}</span>
      ),
    },
    {
      key: "user",
      header: "Recorded by",
      cell: (entry) => <span className="text-sm">{entry.user}</span>,
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Reports"
        description="Stock value, category mix and the movement ledger."
        actions={
          <Button className="rounded-sm" onClick={exportCsv}>
            <Download /> Export CSV
          </Button>
        }
      />

      <KpiStrip items={stats} />

      <div className="grid gap-4 lg:grid-cols-3">
        <StockFlowChart className="lg:col-span-2" />
        <Panel
          title="Value by category"
          description="At unit cost, highest first"
        >
          <ul className="divide-y">
            {categories.map((row) => (
              <li
                key={row.category}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{row.category}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.styles} styles · {row.units} units
                    {row.belowMin > 0 ? ` · ${row.belowMin} below min` : ""}
                  </p>
                </div>
                <span className="text-sm font-medium tabular-nums">
                  {money.format(row.value)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div id="audit" className="flex scroll-mt-6 flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold">Movement ledger</h3>
          <p className="text-xs text-muted-foreground">
            Stock in and out recorded on the floor.
          </p>
        </div>

        <FilterChips
          value={move}
          onChange={setMove}
          options={[
            { value: "all", label: "All", count: movements.length },
            {
              value: "IN",
              label: "Stock in",
              count: movements.filter((entry) => entry.type === "IN").length,
            },
            {
              value: "OUT",
              label: "Stock out",
              count: movements.filter((entry) => entry.type === "OUT").length,
            },
          ]}
        />

        <DataTable
          columns={columns}
          rows={pagination.pageItems}
          rowKey={(entry) => String(entry.id)}
          empty={
            <EmptyState
              icon={ArrowLeftRight}
              title="No movements found"
              description="Try another filter or search."
            />
          }
          footer={
            <TablePagination
              pagination={pagination}
              noun="entries"
              note={q ? `Search: “${q}”` : undefined}
            />
          }
        />
      </div>
    </div>
  )
}
