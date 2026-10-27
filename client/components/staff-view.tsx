"use client"

import * as React from "react"
import { UserPlus, Users } from "lucide-react"

import { DataTable, EmptyState, type Column } from "@/components/data/data-table"
import { FilterChips } from "@/components/data/filter-chips"
import { PageHeader } from "@/components/data/page-header"
import { TablePagination, usePagination } from "@/components/data/pagination"
import { StatusBadge } from "@/components/data/status-badge"
import { KpiStrip } from "@/components/dashboard/kpi-strip"
import { Button } from "@/components/ui/button"
import { useSearchQuery } from "@/hooks/use-search-query"
import { ROLES, type Role } from "@/lib/roles"

type UserRecord = {
  id: number
  name: string
  email: string
  role: Role
  is_active: boolean
  area: string | null
}

const roles: Role[] = ["inventory_manager", "stock_controller", "staff_member"]
const toBackendRole: Record<Role, string> = {
  inventory_manager: "manager",
  stock_controller: "stock_controller",
  staff_member: "staff",
}

export function StaffView() {
  const q = useSearchQuery()
  const [users, setUsers] = React.useState<UserRecord[]>([])
  const [filter, setFilter] = React.useState<"all" | Role>("all")
  const [loading, setLoading] = React.useState(true)
  const [open, setOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState("")
  const [form, setForm] = React.useState({ name: "", email: "", password: "", role: "staff_member" as Role, area: "" })

  const load = React.useCallback(async () => {
    try {
      const response = await fetch("/api/inventory/users", { cache: "no-store" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Could not load users")
      setUsers(result.users)
      setError("")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load users")
    } finally {
      setLoading(false)
    }
  }, [])
  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const rows = users
    .filter((user) => filter === "all" || user.role === filter)
    .filter((user) => [user.name, user.email, ROLES[user.role].label].some((value) => value.toLowerCase().includes(q)))
  const pagination = usePagination(rows, { resetKey: `${q}|${filter}` })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/inventory/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, role: toBackendRole[form.role] }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Could not add user")
      setForm({ name: "", email: "", password: "", role: "staff_member", area: "" })
      setOpen(false)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add user")
    } finally {
      setSaving(false)
    }
  }

  async function setActive(user: UserRecord) {
    setError("")
    try {
      const response = await fetch(`/api/inventory/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !user.is_active }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Could not update user")
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update user")
    }
  }

  const columns: Column<UserRecord>[] = [
    {
      key: "person",
      header: "User",
      cell: (user) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium">{user.name}</span>
          <span className="text-xs text-muted-foreground">{user.email}</span>
        </div>
      ),
    },
    { key: "role", header: "Role", cell: (user) => <span className="text-sm">{ROLES[user.role].label}</span> },
    { key: "area", header: "Area", cell: (user) => <span className="text-sm">{user.area || "—"}</span> },
    {
      key: "status",
      header: "Status",
      cell: (user) => <StatusBadge tone={user.is_active ? "success" : "neutral"}>{user.is_active ? "Active" : "Inactive"}</StatusBadge>,
    },
    {
      key: "action",
      header: "Action",
      align: "right",
      cell: (user) => (
        <Button size="sm" variant="outline" className="h-8 rounded-sm" onClick={() => void setActive(user)}>
          {user.is_active ? "Deactivate" : "Activate"}
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Users"
        description="Manage real user accounts and their access to this inventory."
        actions={<Button className="rounded-sm" onClick={() => setOpen(!open)}><UserPlus /> Add user</Button>}
      />
      <KpiStrip items={[
        { title: "Users", value: String(users.length), note: "Saved accounts", tone: "neutral", icon: Users },
        { title: "Active", value: String(users.filter((user) => user.is_active).length), note: "Can sign in", tone: "good", icon: Users },
        { title: "Managers", value: String(users.filter((user) => user.role === "inventory_manager").length), note: "Inventory managers", tone: "neutral", icon: Users },
        { title: "Stock controllers", value: String(users.filter((user) => user.role === "stock_controller").length), note: "Stock access", tone: "neutral", icon: Users },
      ]} />
      {open && (
        <form onSubmit={submit} className="grid gap-3 rounded-sm border bg-card p-4 sm:grid-cols-2">
          {(["name", "email", "password", "area"] as const).map((field) => (
            <label key={field} className="flex flex-col gap-1 text-xs text-muted-foreground">
              {field === "name" ? "Name" : field === "email" ? "Email" : field === "password" ? "Temporary password" : "Area"}
              <input
                required
                minLength={field === "password" ? 8 : undefined}
                type={field === "email" ? "email" : field === "password" ? "password" : "text"}
                value={form[field]}
                onChange={(event) => setForm({ ...form, [field]: event.target.value })}
                className="h-9 rounded-sm border bg-background px-2 text-sm text-foreground"
              />
            </label>
          ))}
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Role
            <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })} className="h-9 rounded-sm border bg-background px-2 text-sm text-foreground">
              {roles.map((role) => <option key={role} value={role}>{ROLES[role].label}</option>)}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={saving} className="rounded-sm">{saving ? "Saving…" : "Create account"}</Button>
            <Button type="button" variant="outline" className="rounded-sm" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <FilterChips value={filter} onChange={setFilter} options={[
        { value: "all", label: "All", count: users.length },
        ...roles.map((role) => ({ value: role, label: ROLES[role].label, count: users.filter((user) => user.role === role).length })),
      ]} />
      <DataTable
        columns={columns}
        rows={loading ? [] : pagination.pageItems}
        rowKey={(user) => String(user.id)}
        empty={<EmptyState icon={Users} title={loading ? "Loading users…" : error ? "Users unavailable" : "No users found"} description={loading ? "Loading user accounts." : error ? "Check backend availability and manager access." : "Create accounts above to give staff access."} />}
        footer={!loading && rows.length ? <TablePagination pagination={pagination} noun="users" note={q ? `Search: “${q}”` : undefined} /> : undefined}
      />
    </div>
  )
}
