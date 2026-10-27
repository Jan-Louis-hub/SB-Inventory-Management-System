"use client"

import * as React from "react"
import { Plus, Truck } from "lucide-react"

import { DataTable, EmptyState, type Column } from "@/components/data/data-table"
import { PageHeader } from "@/components/data/page-header"
import { TablePagination, usePagination } from "@/components/data/pagination"
import { KpiStrip } from "@/components/dashboard/kpi-strip"
import { Button } from "@/components/ui/button"
import { useSearchQuery } from "@/hooks/use-search-query"
import { addSupplier, getSuppliers, type Supplier } from "@/lib/suppliers"

const initialForm = { name: "", contact_person: "", email: "", phone: "", address: "", city: "", lead_days: "0", categories: "" }

export function SuppliersView() {
  const q = useSearchQuery()
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([])
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState(initialForm)
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      setSuppliers(await getSuppliers())
      setError("")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load suppliers")
    } finally {
      setLoading(false)
    }
  }, [])
  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const rows = suppliers.filter((supplier) =>
    [supplier.name, supplier.contact_person ?? "", supplier.email ?? "", supplier.address ?? ""]
      .some((value) => value.toLowerCase().includes(q))
  )
  const pagination = usePagination(rows, { resetKey: q })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError("")
    try {
      await addSupplier({
        name: form.name.trim(),
        contact_person: form.contact_person.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        lead_days: Number(form.lead_days),
        categories: form.categories.trim() || null,
      })
      setForm(initialForm)
      setOpen(false)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save supplier")
    } finally {
      setSaving(false)
    }
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
          <span className="truncate text-sm font-medium">{supplier.name}</span>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      cell: (supplier) => (
        <div className="flex flex-col">
          <span className="text-sm">{supplier.contact_person || "—"}</span>
          <span className="text-xs text-muted-foreground">{supplier.email || supplier.phone || "No contact details"}</span>
        </div>
      ),
    },
    {
      key: "address",
      header: "Address",
      cell: (supplier) => <span className="text-sm">{[supplier.address, supplier.city].filter(Boolean).join(", ") || "—"}</span>,
    },
    {
      key: "lead",
      header: "Lead time",
      cell: (supplier) => <span className="text-sm">{supplier.lead_days} days</span>,
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Suppliers"
        description="Manage supplier details stored in your inventory database."
        actions={<Button className="rounded-sm" onClick={() => setOpen(!open)}><Plus /> Add supplier</Button>}
      />
      <KpiStrip items={[
        { title: "Suppliers", value: String(suppliers.length), note: "Saved records", tone: "neutral", icon: Truck },
        { title: "With email", value: String(suppliers.filter((supplier) => supplier.email).length), note: "Contactable suppliers", tone: "neutral", icon: Truck },
        { title: "With phone", value: String(suppliers.filter((supplier) => supplier.phone).length), note: "Phone records", tone: "neutral", icon: Truck },
        { title: "With address", value: String(suppliers.filter((supplier) => supplier.address).length), note: "Address records", tone: "neutral", icon: Truck },
      ]} />
      {open && (
        <form onSubmit={submit} className="grid gap-3 rounded-sm border bg-card p-4 sm:grid-cols-2">
          {([
            ["name", "Business name", true],
            ["contact_person", "Contact person", false],
            ["email", "Email", false],
            ["phone", "Phone", false],
            ["address", "Address", false],
            ["city", "City", false],
            ["lead_days", "Lead time (days)", false],
            ["categories", "Product categories", false],
          ] as const).map(([field, label, required]) => (
            <label key={field} className="flex flex-col gap-1 text-xs text-muted-foreground">
              {label}
              <input
                required={required}
                type={field === "email" ? "email" : field === "lead_days" ? "number" : "text"}
                min={field === "lead_days" ? 0 : undefined}
                value={form[field]}
                onChange={(event) => setForm({ ...form, [field]: event.target.value })}
                className="h-9 rounded-sm border bg-background px-2 text-sm text-foreground"
              />
            </label>
          ))}
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={saving} className="rounded-sm">{saving ? "Saving…" : "Save supplier"}</Button>
            <Button type="button" variant="outline" className="rounded-sm" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DataTable
        columns={columns}
        rows={loading ? [] : pagination.pageItems}
        rowKey={(supplier) => String(supplier.id)}
        empty={
          <EmptyState
            icon={Truck}
            title={loading ? "Loading suppliers…" : error ? "Suppliers unavailable" : "No suppliers yet"}
            description={loading ? "Loading saved supplier records." : error ? "Check the backend connection and try again." : "Add a supplier to keep its contact details with your inventory."}
          />
        }
        footer={!loading && rows.length ? <TablePagination pagination={pagination} noun="suppliers" note={q ? `Search: “${q}”` : undefined} /> : undefined}
      />
    </div>
  )
}
