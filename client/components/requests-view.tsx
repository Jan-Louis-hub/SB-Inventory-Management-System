"use client"

import * as React from "react"
import { Inbox } from "lucide-react"

import { DataTable, EmptyState, type Column } from "@/components/data/data-table"
import { PageHeader } from "@/components/data/page-header"
import { StatusBadge } from "@/components/data/status-badge"
import { Button } from "@/components/ui/button"
import { listInventory } from "@/lib/inventory-api"
import {
  createStockRequest,
  listStockRequests,
  resolveStockRequest,
  type StockRequest,
  withdrawStockRequest,
} from "@/lib/stock-operations"
import type { Product } from "@/lib/inventory"

export function RequestsView({ manager = false }: { manager?: boolean }) {
  const [requests, setRequests] = React.useState<StockRequest[]>([])
  const [products, setProducts] = React.useState<Product[]>([])
  const [form, setForm] = React.useState({ product_id: "", quantity: "1", note: "" })
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState("")

  const reload = React.useCallback(async () => {
    try {
      const requestRows = await listStockRequests()
      setRequests(requestRows)
      if (!manager) {
        const inventory = await listInventory()
        setProducts(inventory.products)
      }
      setError("")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load stock requests")
    } finally {
      setLoading(false)
    }
  }, [manager])

  React.useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0)
    return () => window.clearTimeout(timer)
  }, [reload])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError("")
    try {
      await createStockRequest({
        product_id: Number(form.product_id),
        quantity: Number(form.quantity),
        note: form.note.trim(),
      })
      setForm({ product_id: "", quantity: "1", note: "" })
      await reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create stock request")
    } finally {
      setSaving(false)
    }
  }

  async function act(request: StockRequest, action: "approve" | "decline" | "fulfill") {
    setSaving(true)
    setError("")
    try {
      await resolveStockRequest(request.id, action)
      await reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update stock request")
    } finally {
      setSaving(false)
    }
  }

  async function withdraw(request: StockRequest) {
    setSaving(true)
    setError("")
    try {
      await withdrawStockRequest(request.id)
      await reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not withdraw stock request")
    } finally {
      setSaving(false)
    }
  }

  const columns: Column<StockRequest>[] = [
    { key: "number", header: "Request", cell: (item) => <span className="font-mono text-xs">{item.request_number}</span> },
    { key: "product", header: "Product", cell: (item) => <span className="text-sm">{item.product} <span className="font-mono text-xs text-muted-foreground">({item.sku})</span></span> },
    { key: "quantity", header: "Quantity", cell: (item) => <span className="text-sm tabular-nums">{item.quantity}</span> },
    ...(manager ? [{ key: "requester", header: "Requested by", cell: (item: StockRequest) => <span className="text-sm">{item.requester}</span> } satisfies Column<StockRequest>] : []),
    { key: "note", header: "Note", cell: (item) => <span className="text-sm">{item.note || "—"}</span> },
    { key: "status", header: "Status", cell: (item) => <StatusBadge tone={item.status === "fulfilled" ? "success" : item.status === "pending" ? "warning" : item.status === "approved" ? "info" : "neutral"}>{item.status}</StatusBadge> },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (item) => (
        <div className="flex justify-end gap-2">
          {manager && item.status === "pending" && (
            <>
              <Button size="sm" variant="outline" disabled={saving} onClick={() => void act(item, "approve")}>Approve</Button>
              <Button size="sm" variant="outline" disabled={saving} onClick={() => void act(item, "decline")}>Decline</Button>
            </>
          )}
          {manager && item.status === "approved" && (
            <Button size="sm" disabled={saving} onClick={() => void act(item, "fulfill")}>Receive stock</Button>
          )}
          {!manager && item.status === "pending" && (
            <Button size="sm" variant="outline" disabled={saving} onClick={() => void withdraw(item)}>Withdraw</Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Stock requests"
        description={manager ? "Review replenishment requests and record received quantities." : "Request replenishment from the inventory team."}
      />
      {!manager && (
        <form onSubmit={submit} className="grid gap-3 rounded-sm border bg-card p-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Product
            <select required value={form.product_id} onChange={(event) => setForm({ ...form, product_id: event.target.value })} className="h-9 rounded-sm border bg-background px-2 text-sm text-foreground">
              <option value="">Select product</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.sku} · {product.name} ({product.stock} in stock)</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Quantity
            <input required type="number" min="1" step="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} className="h-9 rounded-sm border bg-background px-2 text-sm text-foreground" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Note
            <input maxLength={255} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} className="h-9 rounded-sm border bg-background px-2 text-sm text-foreground" />
          </label>
          <Button type="submit" disabled={saving || !products.length} className="sm:col-span-3 sm:justify-self-start">{saving ? "Saving…" : "Submit request"}</Button>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DataTable
        columns={columns}
        rows={loading ? [] : requests}
        rowKey={(item) => String(item.id)}
        empty={<EmptyState icon={Inbox} title={loading ? "Loading requests…" : error ? "Requests unavailable" : "No stock requests"} description={loading ? "Loading saved requests." : error ? "Check backend availability and your access." : manager ? "Staff replenishment requests will appear here." : "Submit a request above when you need more stock."} />}
      />
    </div>
  )
}
