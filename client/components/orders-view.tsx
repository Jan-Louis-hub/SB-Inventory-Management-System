"use client"

import * as React from "react"
import { PackageSearch, Plus } from "lucide-react"

import { DataTable, EmptyState, type Column } from "@/components/data/data-table"
import { PageHeader } from "@/components/data/page-header"
import { StatusBadge } from "@/components/data/status-badge"
import { Button } from "@/components/ui/button"
import { useSearchQuery } from "@/hooks/use-search-query"
import { listInventory } from "@/lib/inventory-api"
import { createPurchaseOrder, listPurchaseOrders, receivePurchaseOrderItem, type PurchaseOrder } from "@/lib/orders-api"
import { getSuppliers, type Supplier } from "@/lib/suppliers"
import type { OrderRole } from "@/lib/orders"

export function OrdersView({ role }: { role: OrderRole }) {
  const q = useSearchQuery()
  const [orders, setOrders] = React.useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([])
  const [products, setProducts] = React.useState<Awaited<ReturnType<typeof listInventory>>["products"]>([])
  const [loading, setLoading] = React.useState(true)
  const [creating, setCreating] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState("")
  const [form, setForm] = React.useState({ supplier_id: "", product_id: "", quantity: "1", expected_date: "" })

  const load = React.useCallback(async () => {
    try {
      const [orderRows, supplierRows, inventory] = await Promise.all([
        listPurchaseOrders(),
        getSuppliers(),
        listInventory(),
      ])
      setOrders(orderRows)
      setSuppliers(supplierRows)
      setProducts(inventory.products)
      setError("")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load purchase orders")
    } finally {
      setLoading(false)
    }
  }, [])
  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const visible = orders.filter((order) =>
    [order.purchase_number, order.supplier, ...order.items.map((item) => item.product_name)]
      .some((value) => value.toLowerCase().includes(q))
  )
  const openCount = orders.filter((order) => order.status === "ordered" || order.status === "partial").length

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError("")
    try {
      await createPurchaseOrder({
        supplier_id: Number(form.supplier_id),
        expected_date: form.expected_date || undefined,
        items: [{ product_id: Number(form.product_id), quantity_ordered: Number(form.quantity) }],
      })
      setForm({ supplier_id: "", product_id: "", quantity: "1", expected_date: "" })
      setCreating(false)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create purchase order")
    } finally {
      setSaving(false)
    }
  }

  async function receive(order: PurchaseOrder, itemId: number, quantity: number) {
    setError("")
    try {
      await receivePurchaseOrderItem(order.id, itemId, quantity)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not receive stock")
    }
  }

  const columns: Column<PurchaseOrder>[] = [
    {
      key: "order",
      header: "Order",
      cell: (order) => (
        <div className="flex flex-col gap-1">
          <span className="font-mono text-xs font-medium">{order.purchase_number}</span>
          <span className="text-xs text-muted-foreground">{order.items.map((item) => `${item.product_name} × ${item.quantity_ordered}`).join(", ")}</span>
        </div>
      ),
    },
    { key: "supplier", header: "Supplier", cell: (order) => <span className="text-sm">{order.supplier}</span> },
    {
      key: "expected",
      header: "Expected",
      cell: (order) => <span className="text-sm">{order.expected_date || "Not set"}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (order) => <StatusBadge tone={order.status === "received" ? "success" : order.status === "partial" ? "warning" : "info"}>{order.status}</StatusBadge>,
    },
    ...(role === "inventory_manager"
      ? ([{ key: "total", header: "Total", align: "right", cell: (order) => `R ${order.total_amount}` }] satisfies Column<PurchaseOrder>[])
      : []),
    {
      key: "receive",
      header: "Receive stock",
      align: "right",
      cell: (order) => (
        <div className="flex flex-col items-end gap-1">
          {order.items.map((item) => {
            const remaining = item.quantity_ordered - item.quantity_received
            return remaining > 0 && order.status !== "cancelled" ? (
              <Button key={item.id} size="sm" variant="outline" className="h-8 rounded-sm" onClick={() => void receive(order, item.id, remaining)}>
                Receive {remaining} · {item.sku}
              </Button>
            ) : null
          })}
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Purchase orders"
        description={role === "inventory_manager" ? "Create supplier orders and track receipts." : "Receive ordered stock into inventory."}
        actions={role === "inventory_manager" ? <Button className="rounded-sm" onClick={() => setCreating(!creating)}><Plus /> New order</Button> : undefined}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Summary title="Orders" value={orders.length} />
        <Summary title="Open" value={openCount} />
        <Summary title="Received" value={orders.filter((order) => order.status === "received").length} />
      </div>
      {creating && role === "inventory_manager" && (
        <form onSubmit={submit} className="grid gap-3 rounded-sm border bg-card p-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Supplier
            <select required value={form.supplier_id} onChange={(event) => setForm({ ...form, supplier_id: event.target.value })} className="h-9 rounded-sm border bg-background px-2 text-sm text-foreground">
              <option value="">Select supplier</option>
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Product
            <select required value={form.product_id} onChange={(event) => setForm({ ...form, product_id: event.target.value })} className="h-9 rounded-sm border bg-background px-2 text-sm text-foreground">
              <option value="">Select product</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.sku} · {product.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Quantity
            <input required min="1" type="number" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} className="h-9 rounded-sm border bg-background px-2 text-sm text-foreground" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Expected date
            <input type="date" value={form.expected_date} onChange={(event) => setForm({ ...form, expected_date: event.target.value })} className="h-9 rounded-sm border bg-background px-2 text-sm text-foreground" />
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={saving || !suppliers.length || !products.length} className="rounded-sm">{saving ? "Saving…" : "Create order"}</Button>
            <Button type="button" variant="outline" className="rounded-sm" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DataTable
        columns={columns}
        rows={loading ? [] : visible}
        rowKey={(order) => String(order.id)}
        empty={<EmptyState icon={PackageSearch} title={loading ? "Loading orders…" : error ? "Orders unavailable" : "No purchase orders yet"} description={loading ? "Loading orders from the database." : error ? "Check backend availability and your access." : role === "inventory_manager" ? "Create a purchase order after adding suppliers and products." : "New orders will appear here when the manager creates them."} />}
      />
    </div>
  )
}

function Summary({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-sm border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}
