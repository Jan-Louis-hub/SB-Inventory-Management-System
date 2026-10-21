"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertTriangle,
  MapPin,
  Package,
  PackageSearch,
  PackageX,
  Wallet,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { AdjustStock } from "@/components/inventory/adjust-stock"
import { KpiStrip, type Kpi } from "@/components/dashboard/kpi-strip"
import { DataTable, EmptyState, type Column } from "@/components/data/data-table"
import { FilterChips } from "@/components/data/filter-chips"
import { PageHeader } from "@/components/data/page-header"
import { TablePagination, usePagination } from "@/components/data/pagination"
import { StatusBadge, type Tone } from "@/components/data/status-badge"
import { useSearchQuery } from "@/hooks/use-search-query"
import { money } from "@/lib/format"
import {
  getLevel,
  getProductsForRole,
  INVENTORY_VIEW,
  type Product,
  type StockLevel,
} from "@/lib/inventory"
import type { Role } from "@/lib/roles"

const LEVELS: Record<StockLevel, { label: string; tone: Tone }> = {
  in_stock: { label: "In stock", tone: "success" },
  low: { label: "Low", tone: "warning" },
  critical: { label: "Critical", tone: "danger" },
  out: { label: "Out of stock", tone: "danger" },
}

export function InventoryView({ role }: { role: Role }) {
  const view = INVENTORY_VIEW[role]
  const q = useSearchQuery()

  const [products, setProducts] = React.useState<Product[]>(() =>
    getProductsForRole(role)
  )
  const [level, setLevel] = React.useState<StockLevel | "all">("all")
  const [category, setCategory] = React.useState("all")

  const categories = [...new Set(products.map((p) => p.category))].sort()
  const locationCount = new Set(products.map((p) => p.location)).size
  const countLevel = (l: StockLevel) =>
    products.filter((p) => getLevel(p) === l).length

  const lowCount = countLevel("low") + countLevel("critical")
  const outCount = countLevel("out")
  const stockValue = products.reduce((sum, p) => sum + p.stock * (p.cost ?? 0), 0)

  const stats: Kpi[] = [
    {
      title: "Products",
      value: String(products.length),
      note: `${categories.length} categories`,
      tone: "neutral",
      icon: Package,
    },
    {
      title: "Low stock",
      value: String(lowCount),
      note: `${countLevel("critical")} critical`,
      tone: lowCount > 0 ? "bad" : "good",
      icon: AlertTriangle,
      alert: lowCount > 0,
    },
    {
      title: "Out of stock",
      value: String(outCount),
      note: outCount > 0 ? "Needs restocking" : "Nothing missing",
      tone: outCount > 0 ? "bad" : "good",
      icon: PackageX,
    },
    view.showCost
      ? {
          title: "Stock value",
          value: money.format(stockValue),
          note: "At unit cost",
          tone: "neutral",
          icon: Wallet,
        }
      : {
          title: "Locations",
          value: String(locationCount),
          note: "Storage areas",
          tone: "neutral",
          icon: MapPin,
        },
  ]

  const rows = products
    .filter((p) => level === "all" || getLevel(p) === level)
    .filter((p) => category === "all" || p.category === category)
    .filter(
      (p) =>
        !q ||
        [p.name, p.sku, p.category, p.location].some((v) =>
          v.toLowerCase().includes(q)
        )
    )
    .sort((a, b) => a.name.localeCompare(b.name))

  const pagination = usePagination(rows, {
    resetKey: `${q}|${level}|${category}`,
  })

  function adjust(id: string, delta: number) {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, stock: Math.max(0, p.stock + delta) } : p
      )
    )
  }

  const columns: Column<Product>[] = [
    {
      key: "product",
      header: "Product",
      cell: (p) => (
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-muted text-xs font-semibold">
            {p.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{p.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              <span className="font-mono">{p.sku}</span> · {p.category}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "location",
      header: "Location",
      cell: (p) => <span className="text-sm">{p.location}</span>,
    },
    {
      key: "stock",
      header: "Stock",
      cell: (p) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium tabular-nums">
            {p.stock}{" "}
            <span className="font-normal text-muted-foreground">{p.unit}</span>
          </span>
          <span className="text-xs text-muted-foreground">Min {p.min}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (p) => {
        const l = LEVELS[getLevel(p)]
        return <StatusBadge tone={l.tone}>{l.label}</StatusBadge>
      },
    },
    ...(view.showCost
      ? ([
          {
            key: "cost",
            header: "Unit cost",
            align: "right",
            cell: (p) => (
              <span className="text-sm tabular-nums">
                {p.cost !== undefined ? money.format(p.cost) : "-"}
              </span>
            ),
          },
          {
            key: "value",
            header: "Value",
            align: "right",
            cell: (p) => (
              <span className="text-sm font-medium tabular-nums">
                {p.cost !== undefined ? money.format(p.cost * p.stock) : "-"}
              </span>
            ),
          },
        ] satisfies Column<Product>[])
      : []),
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (p) => (
        <div className="flex justify-end gap-1.5">
          {view.actions.includes("adjust") && (
            <AdjustStock product={p} onAdjust={(d) => adjust(p.id, d)} />
          )}
          {view.actions.includes("request") && (
            <Button asChild size="sm" variant="outline" className="h-8 rounded-sm px-3">
              <Link href={`/staff/requests?item=${encodeURIComponent(p.sku)}`}>
                Request
              </Link>
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={view.title} description={view.description} />

      <KpiStrip items={stats} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          value={level}
          onChange={setLevel}
          options={[
            { value: "all", label: "All", count: products.length },
            ...(["in_stock", "low", "critical", "out"] as const).map((l) => ({
              value: l,
              label: LEVELS[l].label,
              count: countLevel(l),
            })),
          ]}
        />

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 rounded-sm border bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">All</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <DataTable
        columns={columns}
        rows={pagination.pageItems}
        rowKey={(p) => p.id}
        empty={
          <EmptyState
            icon={PackageSearch}
            title="No products found"
            description="Try another status, category or search."
          />
        }
        footer={
          <TablePagination
            pagination={pagination}
            noun="products"
            note={q ? `Search: “${q}”` : undefined}
          />
        }
      />
    </div>
  )
}