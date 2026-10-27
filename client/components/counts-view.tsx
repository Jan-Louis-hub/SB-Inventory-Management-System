"use client"

import * as React from "react"
import { ClipboardCheck, RefreshCw } from "lucide-react"

import { DataTable, EmptyState, type Column } from "@/components/data/data-table"
import { PageHeader } from "@/components/data/page-header"
import { StatusBadge } from "@/components/data/status-badge"
import { Button } from "@/components/ui/button"
import { listInventory } from "@/lib/inventory-api"
import {
  completeStockCount,
  createStockCount,
  getStockCount,
  listStockCounts,
  updateStockCountLine,
  type StockCount,
  type StockCountLine,
} from "@/lib/stock-operations"

export function CountsView() {
  const [counts, setCounts] = React.useState<StockCount[]>([])
  const [active, setActive] = React.useState<StockCount | null>(null)
  const [locations, setLocations] = React.useState<string[]>([])
  const [form, setForm] = React.useState({ area: "", location: "", due_label: "" })
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState("")

  const reload = React.useCallback(async () => {
    try {
      const [rows, inventory] = await Promise.all([listStockCounts(), listInventory()])
      setCounts(rows)
      setLocations([...new Set(inventory.products.map((product) => product.location).filter((value) => value && value !== "—"))].sort())
      setError("")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load stock counts")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0)
    return () => window.clearTimeout(timer)
  }, [reload])

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError("")
    try {
      const count = await createStockCount(form)
      setActive(count)
      setForm({ area: "", location: "", due_label: "" })
      await reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create stock count")
    } finally {
      setSaving(false)
    }
  }

  async function refreshCount(countId: number) {
    try {
      setActive(await getStockCount(countId))
      await reload()
      setError("")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update stock count")
    }
  }

  async function saveLine(line: StockCountLine, value: string) {
    if (!active) return
    const quantity = value === "" ? null : Number(value)
    if (quantity !== null && (!Number.isSafeInteger(quantity) || quantity < 0)) {
      setError("Counted quantity must be a non-negative whole number.")
      return
    }
    setSaving(true)
    try {
      setActive(await updateStockCountLine(active.id, line.id, quantity))
      setError("")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save counted quantity")
    } finally {
      setSaving(false)
    }
  }

  async function finishCount() {
    if (!active) return
    setSaving(true)
    try {
      setActive(await completeStockCount(active.id))
      await reload()
      setError("")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not complete stock count")
    } finally {
      setSaving(false)
    }
  }

  const columns: Column<StockCount>[] = [
    { key: "number", header: "Count", cell: (count) => <span className="font-mono text-xs">{count.count_number}</span> },
    { key: "area", header: "Area", cell: (count) => <span className="text-sm">{count.area}</span> },
    { key: "location", header: "Location", cell: (count) => <span className="text-sm">{count.location}</span> },
    { key: "due", header: "Due", cell: (count) => <span className="text-sm">{count.due_label}</span> },
    { key: "owner", header: "Assigned to", cell: (count) => <span className="text-sm">{count.owner ?? "—"}</span> },
    { key: "status", header: "Status", cell: (count) => <StatusBadge tone={count.status === "completed" ? "success" : count.status === "in_progress" ? "warning" : "info"}>{count.status.replace("_", " ")}</StatusBadge> },
    { key: "action", header: "Action", align: "right", cell: (count) => <Button size="sm" variant="outline" onClick={() => void refreshCount(count.id)}>{count.status === "completed" ? "View" : "Count stock"}</Button> },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Stock counts" description="Record physical quantities and reconcile differences against current stock." />
      <form onSubmit={create} className="grid gap-3 rounded-sm border bg-card p-4 sm:grid-cols-4">
        <Field label="Area" value={form.area} onChange={(area) => setForm({ ...form, area })} required />
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Location
          {locations.length ? (
            <select required value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} className="h-9 rounded-sm border bg-background px-2 text-sm text-foreground">
              <option value="">Select location</option>
              {locations.map((location) => <option key={location} value={location}>{location}</option>)}
            </select>
          ) : <input required value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} className="h-9 rounded-sm border bg-background px-2 text-sm text-foreground" />}
        </label>
        <Field label="Due date or label" value={form.due_label} onChange={(due_label) => setForm({ ...form, due_label })} required />
        <Button type="submit" disabled={saving} className="self-end">{saving ? "Creating…" : "Create count"}</Button>
      </form>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DataTable
        columns={columns}
        rows={loading ? [] : counts}
        rowKey={(count) => String(count.id)}
        empty={<EmptyState icon={ClipboardCheck} title={loading ? "Loading stock counts…" : error ? "Counts unavailable" : "No stock counts yet"} description={loading ? "Loading saved stock count records." : error ? "Check backend availability and your access." : "Create a count to snapshot active products at a location."} />}
      />

      {active && (
        <section className="flex flex-col gap-3 rounded-sm border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">{active.count_number} · {active.location}</h2>
              <p className="text-xs text-muted-foreground">Enter the physical count for each product. Completing the count writes stock adjustments to the ledger.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void refreshCount(active.id)} disabled={saving}><RefreshCw /> Refresh</Button>
          </div>
          <DataTable
            columns={[
              { key: "product", header: "Product", cell: (line) => <span className="text-sm">{line.name} <span className="font-mono text-xs text-muted-foreground">({line.sku})</span></span> },
              { key: "expected", header: "Expected", cell: (line) => <span className="text-sm tabular-nums">{line.expected_quantity}</span> },
              { key: "counted", header: "Counted", cell: (line) => <input aria-label={`Counted quantity for ${line.name}`} type="number" min="0" step="1" defaultValue={line.counted_quantity ?? ""} disabled={saving || active.status === "completed"} onBlur={(event) => { if (String(line.counted_quantity ?? "") !== event.target.value) void saveLine(line, event.target.value) }} className="h-8 w-28 rounded-sm border bg-background px-2 text-sm" /> },
            ] satisfies Column<StockCountLine>[]}
            rows={active.lines ?? []}
            rowKey={(line) => String(line.id)}
            empty={<EmptyState icon={ClipboardCheck} title="No products at this location" description="Add active products with this location before creating a count." />}
          />
          {active.status !== "completed" && (
            <Button type="button" disabled={saving || !active.lines?.length || active.lines.some((line) => line.counted_quantity === null)} onClick={() => void finishCount()} className="self-start">
              {saving ? "Saving…" : "Complete and reconcile"}
            </Button>
          )}
        </section>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <input required={required} value={value} onChange={(event) => onChange(event.target.value)} className="h-9 rounded-sm border bg-background px-2 text-sm text-foreground" />
    </label>
  )
}
