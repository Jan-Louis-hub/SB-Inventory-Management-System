"use client"

import * as React from "react"
import { CalendarOff, Plus, Store, UserCheck, Users } from "lucide-react"

import { DataTable, EmptyState, type Column } from "@/components/data/data-table"
import { FilterChips } from "@/components/data/filter-chips"
import { PageHeader } from "@/components/data/page-header"
import { TablePagination, usePagination } from "@/components/data/pagination"
import { StatusBadge, type Tone } from "@/components/data/status-badge"
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
import { LOCATIONS } from "@/lib/inventory"
import { ROLES, type Role } from "@/lib/roles"
import { getTeam, type TeamMember, type TeamStatus } from "@/lib/staff"

const AREAS = ["Office", ...LOCATIONS]
const selectClass =
  "h-8 w-full rounded-sm border bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"

const ROLE_TONE: Record<Role, Tone> = {
  inventory_manager: "info",
  stock_controller: "violet",
  staff_member: "neutral",
}

export function StaffView() {
  const q = useSearchQuery()
  const [members, setMembers] = React.useState<TeamMember[]>(() => getTeam())
  const [role, setRole] = React.useState<"all" | Role>("all")
  const [open, setOpen] = React.useState(false)
  const [error, setError] = React.useState("")
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [newRole, setNewRole] = React.useState<Role>("staff_member")
  const [area, setArea] = React.useState<string>(AREAS[1] ?? "Women's floor")
  const [status, setStatus] = React.useState<TeamStatus>("active")

  const active = members.filter((member) => member.status === "active")
  const away = members.filter((member) => member.status === "leave")
  const floor = active.filter((member) => member.role === "staff_member")
  const roleCount = new Set(members.map((member) => member.role)).size

  const stats: Kpi[] = [
    {
      title: "Team",
      value: String(members.length),
      note: `${roleCount} roles`,
      tone: "neutral",
      icon: Users,
    },
    {
      title: "Active",
      value: String(active.length),
      note: "Working today",
      tone: "good",
      icon: UserCheck,
    },
    {
      title: "On leave",
      value: String(away.length),
      note:
        away.length === 1
          ? away[0].name
          : away.length === 0
            ? "Nobody away"
            : `${away.length} people`,
      tone: away.length > 0 ? "neutral" : "good",
      icon: CalendarOff,
    },
    {
      title: "On the floor",
      value: String(floor.length),
      note: "Staff selling today",
      tone: "neutral",
      icon: Store,
    },
  ]

  const rows = members
    .filter((member) => role === "all" || member.role === role)
    .filter((member) => {
      if (!q) return true
      return [member.name, member.email, member.area, ROLES[member.role].label]
        .some((value) => value.toLowerCase().includes(q))
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const pagination = usePagination(rows, { resetKey: `${q}|${role}` })

  function addMember(event: React.FormEvent) {
    event.preventDefault()
    const nextName = name.trim()
    const nextEmail = email.trim().toLowerCase()
    if (!nextName || !nextEmail) {
      setError("Name and email are required.")
      return
    }
    if (members.some((member) => member.email.toLowerCase() === nextEmail)) {
      setError("That email is already on the team.")
      return
    }

    const next: TeamMember = {
      id: `TM-${String(members.length + 1).padStart(2, "0")}`,
      name: nextName,
      email: nextEmail,
      role: newRole,
      area,
      status,
    }
    setMembers((current) => [...current, next])
    setName("")
    setEmail("")
    setNewRole("staff_member")
    setArea(AREAS[1] ?? "Women's floor")
    setStatus("active")
    setRole("all")
    setError("")
    setOpen(false)
  }

  const columns: Column<TeamMember>[] = [
    {
      key: "person",
      header: "Person",
      cell: (member) => (
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-muted text-xs font-semibold">
            {member.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{member.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {member.email}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      cell: (member) => (
        <StatusBadge tone={ROLE_TONE[member.role]}>
          {ROLES[member.role].label}
        </StatusBadge>
      ),
    },
    {
      key: "area",
      header: "Area",
      cell: (member) => <span className="text-sm">{member.area}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (member) => (
        <StatusBadge tone={member.status === "active" ? "success" : "warning"}>
          {member.status === "active" ? "Active" : "On leave"}
        </StatusBadge>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Staff"
        description="People who use the system, and where they work in the shop."
        actions={
          <Button className="rounded-sm" onClick={() => setOpen(true)}>
            <Plus /> Add user
          </Button>
        }
      />

      <KpiStrip items={stats} />

      <FilterChips
        value={role}
        onChange={setRole}
        options={[
          { value: "all", label: "All", count: members.length },
          ...(
            Object.entries(ROLES) as [Role, (typeof ROLES)[Role]][]
          ).map(([value, { label }]) => ({
            value,
            label,
            count: members.filter((member) => member.role === value).length,
          })),
        ]}
      />

      <DataTable
        columns={columns}
        rows={pagination.pageItems}
        rowKey={(member) => member.id}
        empty={
          <EmptyState
            icon={Users}
            title="No staff found"
            description="Try another role or search."
          />
        }
        footer={
          <TablePagination
            pagination={pagination}
            noun="people"
            note={q ? `Search: “${q}”` : undefined}
          />
        }
      />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <form onSubmit={addMember} className="flex flex-1 flex-col">
            <SheetHeader>
              <SheetTitle>Add user</SheetTitle>
              <SheetDescription>
                Someone who needs access to Harbour Lane.
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-4 px-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="staff-name">Name</Label>
                <Input
                  id="staff-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="staff-email">Email</Label>
                <Input
                  id="staff-email"
                  type="email"
                  value={email}
                  placeholder="name@harbourlane.co.za"
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="staff-role">Role</Label>
                <select
                  id="staff-role"
                  className={selectClass}
                  value={newRole}
                  onChange={(event) => setNewRole(event.target.value as Role)}
                >
                  {(
                    Object.entries(ROLES) as [Role, (typeof ROLES)[Role]][]
                  ).map(([value, { label }]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="staff-area">Area</Label>
                <select
                  id="staff-area"
                  className={selectClass}
                  value={area}
                  onChange={(event) => setArea(event.target.value)}
                >
                  {AREAS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="staff-status">Status</Label>
                <select
                  id="staff-status"
                  className={selectClass}
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as TeamStatus)
                  }
                >
                  <option value="active">Active</option>
                  <option value="leave">On leave</option>
                </select>
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <SheetFooter>
              <Button type="submit" className="rounded-sm">
                Add user
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
