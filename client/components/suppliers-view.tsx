"use client"

import * as React from "react"
import { Clock, Package, Plus, ShoppingCart, Truck } from "lucide-react"

import { DataTable, EmptyState, type Column } from "@/components/data/data-table"
import { PageHeader } from "@/components/data/page-header"
import { TablePagination, usePagination } from "@/components/data/pagination"
import { KpiStrip, type Kpi } from "@/components/dashboard/kpi-strip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useSearchQuery } from "@/hooks/use-search-query"
import { getProductsForRole } from "@/lib/inventory"
import { getOrdersForRole } from "@/lib/orders"
import { getSuppliers, type Supplier } from "@/lib/suppliers"

const emptyForm = {
  name: "",
  contact: "",
  email: "",
  phone: "",
  city: "",
  leadDays: "7",
  categories: "",
}

export function SuppliersView() {
  const q = useSearchQuery()
  const products = React.useMemo(
    () => getProductsForRole("inventory_manager"),
    []
  )
  const orders = React.useMemo(
    () => getOrdersForRole("inventory_manager"),
    []
  )

  const [suppliers, setSuppliers] = React.useState<Supplier[]>(() => getSuppliers())
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState(emptyForm)
  const [error, setError] = React.useState("")

  function stylesFor(name: string) {
    return products.filter((product) => product.supplier === name).length
  }

  function openOrdersFor(name: string) {
    return orders.filter(
      (order) =>
        order.supplier === name &&
        order.status !== "received" &&
        order.status !== "cancelled"
    ).length
  }

  const openOrders = suppliers.reduce(
    (sum, supplier) => sum + openOrdersFor(supplier.name),
    0
  )
  const covered = products.filter((product) =>
    suppliers.some((supplier) => supplier.name === product.supplier)
  ).length
  const longest = suppliers.reduce<(typeof suppliers)[number] | null>(
    (best, supplier) =>
      !best || supplier.leadDays > best.leadDays ? supplier : best,
    null
  )

  const stats: Kpi[] = [
    {
      title: "Suppliers",
      value: String(suppliers.length),
      note: `${new Set(suppliers.map((supplier) => supplier.city)).size} cities`,
      tone: "neutral",
      icon: Truck,
    },
    {
      title: "Open orders",
      value: String(openOrders),
      note: "Not yet received",
      tone: openOrders > 0 ? "neutral" : "good",
      icon: ShoppingCart,
    },
    {
      title: "Styles covered",
      value: String(covered),
      note: covered === products.length ? "Every style has a supplier" : "Of the catalogue",
      tone: "neutral",
      icon: Package,
    },
    {
      title: "Longest lead",
      value: longest ? `${longest.leadDays} days` : "—",
      note: longest?.name ?? "No suppliers",
      tone: "neutral",
      icon: Clock,
    },
  ]

  const rows = suppliers
    .filter((supplier) => {
      if (!q) return true
      return [supplier.name, supplier.contact, supplier.email, supplier.city, supplier.categories]
        .some((value) => value.toLowerCase().includes(q))
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const pagination = usePagination(rows, { resetKey: q })

  function update<K extends keyof typeof emptyForm>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
    setError("")
  }

  function addSupplier(event: React.FormEvent) {
    event.preventDefault()
    const name = form.name.trim()
    const contact = form.contact.trim()
    const email = form.email.trim()
    const leadDays = Number.parseInt(form.leadDays, 10)

    if (!name || !contact || !email) {
      setError("Name, contact and email are required.")
      return
    }
    if (suppliers.some((supplier) => supplier.name.toLowerCase() === name.toLowerCase())) {
      setError("A supplier with that name is already on the list.")
      return
    }
    if (!Number.isInteger(leadDays) || leadDays < 1) {
      setError("Lead time needs to be at least 1 day.")
      return
    }

    const next: Supplier = {
      id: `SUP-${String(suppliers.length + 1).padStart(2, "0")}`,
      name,
      contact,
      email,
      phone: form.phone.trim() || "—",
      city: form.city.trim() || "—",
      leadDays,
      categories: form.categories.trim() || "Not set",
    }
    setSuppliers((current) => [next, ...current])
    setForm(emptyForm)
    setOpen(false)
  }

  const columns: Column<Supplier>[] = [
    {
      key: "supplier",
      header: "Supplier",
      cell: (supplier) => (
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-muted text-xs font-semibold">
            {supplier.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{supplier.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {supplier.contact} · {supplier.city}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "categories",
      header: "Supplies",
      cell: (supplier) => <span className="text-sm">{supplier.categories}</span>,
    },
    {
      key: "contact",
      header: "Contact",
      cell: (supplier) => (
        <div className="flex flex-col">
          <span className="text-sm">{supplier.email}</span>
          <span className="text-xs text-muted-foreground">{supplier.phone}</span>
        </div>
      ),
    },
    {
      key: "lead",
      header: "Lead time",
      cell: (supplier) => (
        <span className="text-sm tabular-nums">{supplier.leadDays} days</span>
      ),
    },
    {
      key: "orders",
      header: "Open orders",
      align: "right",
      cell: (supplier) => (
        <span className="text-sm font-medium tabular-nums">
          {openOrdersFor(supplier.name)}
        </span>
      ),
    },
    {
      key: "styles",
      header: "Styles",
      align: "right",
      cell: (supplier) => (
        <span className="text-sm tabular-nums">{stylesFor(supplier.name)}</span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Suppliers"
        description="Workrooms and wholesalers who cut and ship the clothing."
        actions={
          <Button className="rounded-sm" onClick={() => setOpen(true)}>
            <Plus /> Add supplier
          </Button>
        }
      />

      <KpiStrip items={stats} />

      <DataTable
        columns={columns}
        rows={pagination.pageItems}
        rowKey={(supplier) => supplier.id}
        empty={
          <EmptyState
            icon={Truck}
            title="No suppliers found"
            description="Try another search, or add a wholesaler."
          />
        }
        footer={
          <TablePagination
            pagination={pagination}
            noun="suppliers"
            note={q ? `Search: “${q}”` : undefined}
          />
        }
      />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <form onSubmit={addSupplier} className="flex flex-1 flex-col">
            <SheetHeader>
              <SheetTitle>Add supplier</SheetTitle>
              <SheetDescription>
                A wholesaler Harbour Lane can raise purchase orders with.
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-4 px-4">
              <Field label="Business name" value={form.name} onChange={(value) => update("name", value)} />
              <Field label="Contact person" value={form.contact} onChange={(value) => update("contact", value)} />
              <Field label="Email" type="email" value={form.email} onChange={(value) => update("email", value)} />
              <Field label="Phone" value={form.phone} onChange={(value) => update("phone", value)} />
              <Field label="City" value={form.city} onChange={(value) => update("city", value)} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="supplier-lead">Lead time (days)</Label>
                <Input
                  id="supplier-lead"
                  type="number"
                  min={1}
                  value={form.leadDays}
                  onChange={(event) => update("leadDays", event.target.value)}
                />
              </div>
              <Field
                label="What they supply"
                value={form.categories}
                onChange={(value) => update("categories", value)}
                placeholder="Tops, knitwear"
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <SheetFooter>
              <Button type="submit" className="rounded-sm">
                Add supplier
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
}) {
  const id = React.useId()
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
