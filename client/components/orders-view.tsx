"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { differenceInCalendarDays, format, parseISO } from "date-fns"
import { ChevronLeft, ChevronRight, PackageSearch } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  getOrdersForRole,
  ORDER_VIEW,
  type Order,
  type OrderRole,
  type OrderStatus,
} from "@/lib/orders"

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  approved: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  shipped: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  delayed: "bg-red-500/10 text-red-600 dark:text-red-400",
  received: "bg-green-500/10 text-green-600 dark:text-green-400",
  cancelled: "bg-muted text-muted-foreground",
}

const PAGE_SIZES = [5, 10, 20]

// Change the currency to match your business
const money = new Intl.NumberFormat("en", { style: "currency", currency: "USD" })

// 1 … 4 5 6 … 12 style page list
function getPageItems(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const items: (number | "…")[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  if (start > 2) items.push("…")
  for (let i = start; i <= end; i++) items.push(i)
  if (end < total - 1) items.push("…")
  items.push(total)

  return items
}

export function OrdersView({ role }: { role: OrderRole }) {
  const view = ORDER_VIEW[role]
  const q = (useSearchParams().get("q") ?? "").trim().toLowerCase()

  const [orders, setOrders] = React.useState<Order[]>(() => getOrdersForRole(role))
  const [filter, setFilter] = React.useState<OrderStatus | "all">("all")
  const [pageState, setPageState] = React.useState(() => ({ query: q, page: 1 }))
  const page = pageState.query === q ? pageState.page : 1
  const setPage = (nextPage: number) => setPageState({ query: q, page: nextPage })
  const [pageSize, setPageSize] = React.useState(10)

  // Read the current time after mount, not during render (avoids the prerender error)
  const [today, setToday] = React.useState<Date | null>(null)
  React.useEffect(() => {
    const timeout = window.setTimeout(() => setToday(new Date()), 0)
    return () => window.clearTimeout(timeout)
  }, [])

  const count = (s: OrderStatus) => orders.filter((o) => o.status === s).length
  const open = orders.filter(
    (o) => o.status !== "received" && o.status !== "cancelled"
  )
  const openValue = open.reduce((sum, o) => sum + (o.total ?? 0), 0)

  const stats = [
    { label: "Open orders", value: String(open.length) },
    { label: "Delayed", value: String(count("delayed")), alert: count("delayed") > 0 },
    { label: "Received", value: String(count("received")) },
    ...(view.showTotal
      ? [{ label: "Open value", value: money.format(openValue) }]
      : []),
  ]

  const rows = orders
    .filter((o) => filter === "all" || o.status === filter)
    .filter(
      (o) =>
        !q ||
        [o.id, o.supplier, o.items].some((v) => v.toLowerCase().includes(q))
    )
    .sort((a, b) => a.expected.localeCompare(b.expected))

  // Pagination. currentPage is clamped, so if a status change shrinks
  // the list (e.g. approving the last "pending" order on page 2) you
  // land on the last page that still exists.
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const pageRows = rows.slice(startIndex, startIndex + pageSize)
  const from = rows.length === 0 ? 0 : startIndex + 1
  const to = startIndex + pageRows.length

  function setStatus(id: string, status: OrderStatus) {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)))
  }

  function dueHint(o: Order) {
    if (!today || o.status === "received" || o.status === "cancelled") return null
    const d = differenceInCalendarDays(parseISO(o.expected), today)
    if (d < 0) return { text: `${-d}d overdue`, className: "text-red-600 dark:text-red-400" }
    if (d === 0) return { text: "Due today", className: "text-amber-600 dark:text-amber-400" }
    if (d === 1) return { text: "Tomorrow", className: "text-muted-foreground" }
    return { text: `In ${d} days`, className: "text-muted-foreground" }
  }

  const columns = view.showTotal ? 6 : 5

  const pageButton =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-sm border px-2 text-xs tabular-nums transition-colors"

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{view.title}</h2>
        <p className="text-sm text-muted-foreground">{view.description}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-sm border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p
              className={cn(
                "mt-1 text-2xl font-semibold tabular-nums tracking-tight",
                s.alert && "text-red-600 dark:text-red-400"
              )}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-1.5">
        {(["all", ...view.statuses] as const).map((s) => {
          const active = filter === s
          const n = s === "all" ? orders.length : count(s)
          return (
            <button
              key={s}
              type="button"
              onClick={() => {
                setFilter(s)
                setPage(1)
              }}
              className={cn(
                "inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 text-sm capitalize transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {s}
              <span
                className={cn(
                  "text-xs tabular-nums",
                  active ? "text-primary-foreground/70" : "text-muted-foreground/70"
                )}
              >
                {n}
              </span>
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-sm border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {["Order", "Supplier", "Expected", "Status"].map((h) => (
                <TableHead
                  key={h}
                  className="h-10 px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {h}
                </TableHead>
              ))}
              {view.showTotal && (
                <TableHead className="h-10 px-4 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total
                </TableHead>
              )}
              <TableHead className="h-10 px-4 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns + 1} className="h-48">
                  <div className="flex flex-col items-center justify-center gap-2 text-center">
                    <div className="flex size-10 items-center justify-center rounded-sm bg-muted">
                      <PackageSearch className="size-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">No orders found</p>
                    <p className="text-xs text-muted-foreground">
                      Try another status filter or a different search.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((o) => {
                const hint = dueHint(o)
                const actions = view.actions[o.status] ?? []

                return (
                  <TableRow key={o.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {o.id}
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-muted text-xs font-semibold">
                          {o.supplier.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium">
                            {o.supplier}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {o.items}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm">
                          {format(parseISO(o.expected), "d MMM yyyy")}
                        </span>
                        {hint && (
                          <span className={cn("text-xs", hint.className)}>
                            {hint.text}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-medium capitalize",
                          STATUS_STYLES[o.status]
                        )}
                      >
                        <span className="size-1.5 rounded-full bg-current" />
                        {o.status}
                      </span>
                    </TableCell>

                    {view.showTotal && (
                      <TableCell className="px-4 py-3 text-right text-sm font-medium tabular-nums">
                        {o.total !== undefined ? money.format(o.total) : "-"}
                      </TableCell>
                    )}

                    <TableCell className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {actions.map((a) => (
                          <Button
                            key={a.label}
                            size="sm"
                            variant={a.to === "cancelled" ? "ghost" : "outline"}
                            className={cn(
                              "h-8 rounded-sm px-3",
                              a.to === "cancelled" &&
                                "text-red-600 hover:text-red-600 dark:text-red-400"
                            )}
                            onClick={() => setStatus(o.id, a.to)}
                          >
                            {a.label}
                          </Button>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        {/* Footer: count, rows per page, pagination */}
        <div className="flex flex-col gap-3 border-t bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span>
              Showing {from}–{to} of {rows.length} orders
              {q && <> · Search: “{q}”</>}
            </span>

            <label className="flex items-center gap-2">
              Rows per page
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
                className="h-8 rounded-sm border bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {totalPages > 1 && (
            <nav aria-label="Pagination" className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous page"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
                className={cn(
                  pageButton,
                  "hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                )}
              >
                <ChevronLeft className="size-4" />
              </button>

              {/* Small screens: just "Page 2 of 5" */}
              <span className="px-2 sm:hidden">
                Page {currentPage} of {totalPages}
              </span>

              {/* Larger screens: page numbers */}
              <div className="hidden items-center gap-1 sm:flex">
                {getPageItems(currentPage, totalPages).map((item, i) =>
                  item === "…" ? (
                    <span key={`gap-${i}`} className="px-1">
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      aria-label={`Page ${item}`}
                      aria-current={item === currentPage ? "page" : undefined}
                      onClick={() => setPage(item)}
                      className={cn(
                        pageButton,
                        item === currentPage
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {item}
                    </button>
                  )
                )}
              </div>

              <button
                type="button"
                aria-label="Next page"
                disabled={currentPage === totalPages}
                onClick={() => setPage(currentPage + 1)}
                className={cn(
                  pageButton,
                  "hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                )}
              >
                <ChevronRight className="size-4" />
              </button>
            </nav>
          )}
        </div>
      </div>
    </div>
  )
}