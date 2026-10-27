"use client"

import * as React from "react"
import {
  AlertTriangle,
  Package,
  PackageMinus,
  PackagePlus,
  PackageSearch,
  PackageX,
  Wallet,
} from "lucide-react"

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
  createCategory,
  createProduct,
  archiveProduct,
  listInventory,
  recordStockMovement,
  type Category,
} from "@/lib/inventory-api"
import { getLevel, INVENTORY_VIEW, type Product, type StockLevel } from "@/lib/inventory"
import type { Role } from "@/lib/roles"

const LEVELS: Record<StockLevel, { label: string; tone: Tone }> = {
  in_stock: { label: "In stock", tone: "success" },
  low: { label: "Low", tone: "warning" },
  critical: { label: "Critical", tone: "danger" },
  out: { label: "Out of stock", tone: "danger" },
}

const emptyProduct = {
  sku: "",
  name: "",
  description: "",
  category_id: "",
  supplier_id: "",
  location: "",
  unit: "units",
  cost_price: "",
  selling_price: "",
  quantity: "0",
  reorder_level: "0",
}

export function InventoryView({ role }: { role: Role }) {
  const view = INVENTORY_VIEW[role]
  const q = useSearchQuery()
  const [products, setProducts] = React.useState<Product[]>([])
  const [categories, setCategories] = React.useState<Category[]>([])
  const [suppliers, setSuppliers] = React.useState<Awaited<ReturnType<typeof listInventory>>["suppliers"]>([])
  const [level, setLevel] = React.useState<StockLevel | "all">("all")
  const [category, setCategory] = React.useState("all")
  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState("")
  const [notice, setNotice] = React.useState("")
  const [form, setForm] = React.useState(emptyProduct)
  const [defaultMin, setDefaultMin] = React.useState(0)
  const [categoryName, setCategoryName] = React.useState("")
  const [categoryError, setCategoryError] = React.useState("")

  const reload = React.useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const result = await listInventory()
      setProducts(result.products)
      setCategories(result.categories)
      setSuppliers(result.suppliers)
      if (role === "inventory_manager") {
        const response = await fetch("/api/inventory/settings", { cache: "no-store" })
        const settings = await response.json()
        if (!response.ok) throw new Error(settings.error ?? "Could not load business settings")
        setDefaultMin(settings.settings.default_min)
        setForm((current) =>
          current.sku || current.reorder_level !== "0"
            ? current
            : { ...current, reorder_level: String(settings.settings.default_min) }
        )
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load inventory")
    } finally {
      setLoading(false)
    }
  }, [role])

  React.useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0)
    return () => window.clearTimeout(timer)
  }, [reload])

  const productCategories = [...new Set(products.map((product) => product.category))].sort()
  const countLevel = (value: StockLevel) =>
    products.filter((product) => getLevel(product) === value).length
  const lowCount = countLevel("low") + countLevel("critical")
  const outCount = countLevel("out")
  const stockValue = products.reduce(
    (sum, product) => sum + product.stock * (product.cost ?? 0),
    0
  )
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
    {
      title: view.showCost ? "Stock value" : "Units on hand",
      value: view.showCost
        ? money.format(stockValue)
        : String(products.reduce((sum, product) => sum + product.stock, 0)),
      note: view.showCost ? "At unit cost" : "Across active products",
      tone: "neutral",
      icon: view.showCost ? Wallet : Package,
    },
  ]

  const rows = products
    .filter((product) => level === "all" || getLevel(product) === level)
    .filter((product) => category === "all" || product.category === category)
    .filter(
      (product) =>
        !q ||
        [product.name, product.sku, product.category].some((value) =>
          value.toLowerCase().includes(q)
        )
    )
    .sort((a, b) => a.name.localeCompare(b.name))
  const pagination = usePagination(rows, { resetKey: `${q}|${level}|${category}` })

  async function adjust(product: Product, delta: number, reason: string) {
    await recordStockMovement({
      product_id: Number(product.id),
      movement_type: delta > 0 ? "stock_in" : "stock_out",
      quantity: Math.abs(delta),
      reason,
    })
    await reload()
  }

  async function archive(product: Product) {
    setError("")
    setNotice("")
    try {
      await archiveProduct(Number(product.id))
      setNotice(`${product.name} archived.`)
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not archive product")
    }
  }

  async function submitProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setNotice("")
    setSubmitting(true)
    try {
      await createProduct({
        sku: form.sku.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        category_id: form.category_id ? Number(form.category_id) : null,
        supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
        location: form.location.trim() || null,
        unit: form.unit.trim() || "units",
        cost_price: form.cost_price,
        selling_price: form.selling_price,
        quantity: Number(form.quantity),
        reorder_level: Number(form.reorder_level),
      })
      setForm({ ...emptyProduct, reorder_level: String(defaultMin) })
      setNotice("Product saved.")
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save product")
    } finally {
      setSubmitting(false)
    }
  }

  async function submitCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCategoryError("")
    try {
      await createCategory({ name: categoryName.trim() })
      setCategoryName("")
      setNotice("Category saved.")
      await reload()
    } catch (caught) {
      setCategoryError(caught instanceof Error ? caught.message : "Could not save category")
    }
  }

  const columns: Column<Product>[] = [
    {
      key: "product",
      header: "Product",
      cell: (product) => (
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-muted text-xs font-semibold">
            {product.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{product.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              <span className="font-mono">{product.sku}</span> · {product.category}
              {product.location ? ` · ${product.location}` : ""}
              {product.supplier ? ` · ${product.supplier}` : ""}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "stock",
      header: "Stock",
      cell: (product) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium tabular-nums">{product.stock} {product.unit || "units"}</span>
          <span className="text-xs text-muted-foreground">Reorder at {product.min}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (product) => {
        const status = LEVELS[getLevel(product)]
        return <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      },
    },
    ...(view.showCost
      ? ([{
          key: "cost",
          header: "Unit cost",
          align: "right",
          cell: (product) => (
            <span className="text-sm tabular-nums">
              {product.cost === undefined ? "—" : money.format(product.cost)}
            </span>
          ),
        }] satisfies Column<Product>[])
      : []),
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (product) => (
        <div className="flex items-center justify-end gap-2">
          {view.actions.includes("adjust") && (
            <AdjustStock product={product} onAdjust={(delta, reason) => adjust(product, delta, reason)} />
          )}
          {role === "inventory_manager" && (
            <button type="button" className="inline-flex h-8 items-center gap-1 rounded-sm border px-2 text-xs" onClick={() => void archive(product)} aria-label={`Archive ${product.name}`}>
              <PackageMinus className="size-3.5" /> Archive
            </button>
          )}
          {!view.actions.includes("adjust") && role !== "inventory_manager" && (
            <span className="text-xs text-muted-foreground">View only</span>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={view.title} description={view.description} />
      <KpiStrip items={stats} />

      {role === "inventory_manager" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <form onSubmit={submitProduct} className="flex flex-col gap-3 rounded-sm border bg-card p-4">
            <div className="flex items-center gap-2">
              <PackagePlus className="size-4" />
              <h3 className="text-sm font-semibold">Add product</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="SKU" required value={form.sku} onChange={(sku) => setForm({ ...form, sku })} />
              <Field label="Product name" required value={form.name} onChange={(name) => setForm({ ...form, name })} />
              <Field label="Cost price" required type="number" step="0.01" min="0" value={form.cost_price} onChange={(cost_price) => setForm({ ...form, cost_price })} />
              <Field label="Selling price" required type="number" step="0.01" min="0" value={form.selling_price} onChange={(selling_price) => setForm({ ...form, selling_price })} />
              <Field label="Opening quantity" type="number" min="0" value={form.quantity} onChange={(quantity) => setForm({ ...form, quantity })} />
              <Field label="Reorder level" type="number" min="0" value={form.reorder_level} onChange={(reorder_level) => setForm({ ...form, reorder_level })} />
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Category
                <select
                  value={form.category_id}
                  onChange={(event) => setForm({ ...form, category_id: event.target.value })}
                  className="h-9 rounded-sm border bg-background px-2 text-sm text-foreground"
                >
                  <option value="">Uncategorized</option>
                  {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Supplier
                <select
                  value={form.supplier_id}
                  onChange={(event) => setForm({ ...form, supplier_id: event.target.value })}
                  className="h-9 rounded-sm border bg-background px-2 text-sm text-foreground"
                >
                  <option value="">No supplier</option>
                  {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
              </label>
              <Field label="Location" value={form.location} onChange={(location) => setForm({ ...form, location })} />
              <Field label="Unit" value={form.unit} onChange={(unit) => setForm({ ...form, unit })} />
            </div>
            <Field label="Description" value={form.description} onChange={(description) => setForm({ ...form, description })} />
            <button disabled={submitting} className="h-9 self-start rounded-sm bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50">
              {submitting ? "Saving…" : "Save product"}
            </button>
          </form>

          <form onSubmit={submitCategory} className="flex flex-col gap-3 rounded-sm border bg-card p-4">
            <h3 className="text-sm font-semibold">Add category</h3>
            <Field label="Category name" required value={categoryName} onChange={setCategoryName} />
            <button className="h-9 self-start rounded-sm border px-3 text-sm">Save category</button>
            {categoryError && <p role="alert" className="text-sm text-destructive">{categoryError}</p>}
            <p className="text-xs text-muted-foreground">{categories.length} categories currently saved.</p>
          </form>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          value={level}
          onChange={setLevel}
          options={[
            { value: "all", label: "All", count: products.length },
            ...(["in_stock", "low", "critical", "out"] as const).map((value) => ({
              value,
              label: LEVELS[value].label,
              count: countLevel(value),
            })),
          ]}
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Category
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-9 rounded-sm border bg-background px-2 text-sm text-foreground"
          >
            <option value="all">All</option>
            {productCategories.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      </div>
      <DataTable
        columns={columns}
        rows={loading ? [] : pagination.pageItems}
        rowKey={(product) => product.id}
        empty={
          <EmptyState
            icon={PackageSearch}
            title={loading ? "Loading inventory…" : error ? "Inventory unavailable" : "No products yet"}
            description={
              loading
                ? "Loading products and categories from your database."
                : error
                  ? "Check the backend connection and try again."
                  : role === "inventory_manager"
                    ? "Add a product above to start tracking real stock."
                    : "Products added by your inventory manager will appear here."
            }
          />
        }
        footer={
          !loading && products.length > 0 ? (
            <TablePagination pagination={pagination} noun="products" note={q ? `Search: “${q}”` : undefined} />
          ) : undefined
        }
      />
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  step,
  min,
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  step?: string
  min?: string
  required?: boolean
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <input
        required={required}
        type={type}
        step={step}
        min={min}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-sm border bg-background px-2 text-sm text-foreground"
      />
    </label>
  )
}
