"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { Check, Clock, Inbox, PackageCheck, Plus } from "lucide-react"

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
import { Textarea } from "@/components/ui/textarea"
import { useSearchQuery } from "@/hooks/use-search-query"
import { getProductsForRole } from "@/lib/inventory"
import {
  getRequests,
  type RequestStatus,
  type StockRequest,
} from "@/lib/requests"

const selectClass =
  "h-8 w-full rounded-sm border bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"

const TONE: Record<RequestStatus, Tone> = {
  pending: "warning",
  approved: "info",
  declined: "neutral",
  fulfilled: "success",
}

const RANK: Record<RequestStatus, number> = {
  pending: 0,
  approved: 1,
  declined: 2,
  fulfilled: 3,
}

const FILTERS: RequestStatus[] = ["pending", "approved", "declined", "fulfilled"]

function label(status: RequestStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function RequestsView() {
  const q = useSearchQuery()
  const preset = useSearchParams().get("item") ?? ""
  const products = React.useMemo(
    () =>
      getProductsForRole("staff_member").sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    []
  )
  const bySku = React.useMemo(
    () => new Map(products.map((product) => [product.sku, product])),
    [products]
  )
  const presetKnown = bySku.has(preset)

  const [requests, setRequests] = React.useState<StockRequest[]>(() =>
    getRequests()
  )
  const [filter, setFilter] = React.useState<"all" | RequestStatus>("all")
  const [open, setOpen] = React.useState(presetKnown)
  const [sku, setSku] = React.useState(
    presetKnown ? preset : (products[0]?.sku ?? "")
  )
  const [qty, setQty] = React.useState("1")
  const [note, setNote] = React.useState("")
  const [error, setError] = React.useState("")

  const openCount = requests.filter(
    (request) => request.status === "pending" || request.status === "approved"
  ).length
  const pendingCount = requests.filter(
    (request) => request.status === "pending"
  ).length
  const approvedCount = requests.filter(
    (request) => request.status === "approved"
  ).length

  const stats: Kpi[] = [
    {
      title: "Open",
      value: String(openCount),
      note: "Pending or approved",
      tone: "neutral",
      icon: Inbox,
    },
    {
      title: "Pending",
      value: String(pendingCount),
      note: "Waiting on a decision",
      tone: pendingCount > 0 ? "neutral" : "good",
      icon: Clock,
    },
    {
      title: "Approved",
      value: String(approvedCount),
      note: "Being ordered",
      tone: "good",
      icon: Check,
    },
    {
      title: "Fulfilled",
      value: String(
        requests.filter((request) => request.status === "fulfilled").length
      ),
      note: "Already received",
      tone: "neutral",
      icon: PackageCheck,
    },
  ]

  const rows = requests
    .filter((request) => filter === "all" || request.status === filter)
    .filter((request) => {
      if (!q) return true
      const product = bySku.get(request.sku)
      return [request.id, request.sku, request.note, request.when, product?.name ?? ""]
        .some((value) => value.toLowerCase().includes(q))
    })
    .sort((a, b) => {
      const byStatus = RANK[a.status] - RANK[b.status]
      if (byStatus !== 0) return byStatus
      if (a.id === b.id) return 0
      return a.id < b.id ? 1 : -1
    })

  const pagination = usePagination(rows, { resetKey: `${q}|${filter}` })

  function withdraw(id: string) {
    setRequests((current) => current.filter((request) => request.id !== id))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const product = bySku.get(sku)
    const amount = Number.parseInt(qty, 10)
    if (!product) {
      setError("Choose a style from the catalogue.")
      return
    }
    if (!Number.isInteger(amount) || amount < 1) {
      setError("Quantity has to be at least 1.")
      return
    }

    const nextNumber =
      requests.reduce((max, request) => {
        const value = Number(request.id.replace("REQ-", ""))
        return Number.isFinite(value) ? Math.max(max, value) : max
      }, 0) + 1

    const next: StockRequest = {
      id: `REQ-${nextNumber}`,
      sku: product.sku,
      qty: amount,
      note: note.trim(),
      when: "Today",
      status: "pending",
      requester: "Amahle Dlamini",
    }
    setRequests((current) => [next, ...current])
    setQty("1")
    setNote("")
    setError("")
    setFilter("pending")
    setOpen(false)
  }

  const columns: Column<StockRequest>[] = [
    {
      key: "request",
      header: "Request",
      cell: (request) => (
        <div className="flex flex-col">
          <span className="font-mono text-xs text-muted-foreground">
            {request.id}
          </span>
          <span className="text-xs text-muted-foreground">{request.when}</span>
        </div>
      ),
    },
    {
      key: "item",
      header: "Item",
      cell: (request) => {
        const product = bySku.get(request.sku)
        return (
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">
              {product?.name ?? request.sku}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              <span className="font-mono">{request.sku}</span>
              {request.note ? ` · ${request.note}` : ""}
            </span>
          </div>
        )
      },
    },
    {
      key: "qty",
      header: "Qty",
      cell: (request) => (
        <span className="text-sm tabular-nums">
          {request.qty} {bySku.get(request.sku)?.unit ?? "units"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (request) => (
        <StatusBadge tone={TONE[request.status]}>
          {label(request.status)}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (request) =>
        request.status === "pending" ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 rounded-sm px-3 text-red-600 hover:text-red-600 dark:text-red-400"
            onClick={() => withdraw(request.id)}
          >
            Withdraw
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Requests"
        description="Ask for stock to be reordered, and track what you have already asked for."
        actions={
          <Button className="rounded-sm" onClick={() => setOpen(true)}>
            <Plus /> New request
          </Button>
        }
      />

      <KpiStrip items={stats} />

      <FilterChips
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "All", count: requests.length },
          ...FILTERS.map((status) => ({
            value: status,
            label: label(status),
            count: requests.filter((request) => request.status === status).length,
          })),
        ]}
      />

      <DataTable
        columns={columns}
        rows={pagination.pageItems}
        rowKey={(request) => request.id}
        empty={
          <EmptyState
            icon={Inbox}
            title="No requests found"
            description="Try another status or search, or ask for a style."
          />
        }
        footer={
          <TablePagination
            pagination={pagination}
            noun="requests"
            note={q ? `Search: “${q}”` : undefined}
          />
        }
      />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <form onSubmit={submit} className="flex flex-1 flex-col">
            <SheetHeader>
              <SheetTitle>New request</SheetTitle>
              <SheetDescription>
                {presetKnown
                  ? "Prefilled from the style you were looking at."
                  : "Tell the buyer what the floor is running short of."}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-4 px-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="request-sku">Style</Label>
                <select
                  id="request-sku"
                  className={selectClass}
                  value={sku}
                  onChange={(event) => setSku(event.target.value)}
                >
                  {products.map((product) => (
                    <option key={product.sku} value={product.sku}>
                      {product.name} · {product.sku}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="request-qty">Quantity</Label>
                <Input
                  id="request-qty"
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(event) => setQty(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="request-note">Note</Label>
                <Textarea
                  id="request-note"
                  value={note}
                  placeholder="Size run, display, or who asked."
                  className="rounded-sm"
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <SheetFooter>
              <Button type="submit" className="rounded-sm">
                Submit request
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
