"use client"

import * as React from "react"
import {
  AlertTriangle,
  CheckCheck,
  ClipboardCheck,
  ClipboardList,
  Plus,
} from "lucide-react"

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
import {
  countLines,
  countProgress,
  getCounts,
  type CountLine,
  type CountStatus,
  type StockCount,
} from "@/lib/counts"
import { LOCATIONS } from "@/lib/inventory"
import { getTeam } from "@/lib/staff"
import { cn } from "@/lib/utils"

const DUE_OPTIONS = ["Today", "Tomorrow", "Friday", "Next week"]
const selectClass =
  "h-8 w-full rounded-sm border bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"

const TONE: Record<CountStatus, Tone> = {
  scheduled: "neutral",
  in_progress: "violet",
  completed: "success",
}

const STATUS_LABEL: Record<CountStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
}

const FILTERS: CountStatus[] = ["scheduled", "in_progress", "completed"]

export function CountsView() {
  const q = useSearchQuery()
  const team = React.useMemo(() => getTeam(), [])
  const [counts, setCounts] = React.useState<StockCount[]>(() => getCounts())
  const [filter, setFilter] = React.useState<"all" | CountStatus>("all")
  const [selected, setSelected] = React.useState<string | null>("CNT-011")
  const [open, setOpen] = React.useState(false)
  const [error, setError] = React.useState("")

  const busy = new Set(
    counts
      .filter((count) => count.status !== "completed")
      .map((count) => count.location)
  )
  const free = LOCATIONS.filter((location) => !busy.has(location))
  const [location, setLocation] = React.useState<string>(free[0] ?? "")
  const [due, setDue] = React.useState(DUE_OPTIONS[0])
  const [owner, setOwner] = React.useState(
    team.find((member) => member.name === "James Nkosi")?.name ??
      team[0]?.name ??
      ""
  )

  const short = counts.reduce(
    (sum, count) => sum + countProgress(count.location, count.counted).short,
    0
  )
  const scheduled = counts.filter((count) => count.status === "scheduled").length
  const inProgress = counts.filter((count) => count.status === "in_progress").length
  const completed = counts.filter((count) => count.status === "completed").length

  const stats: Kpi[] = [
    {
      title: "Scheduled",
      value: String(scheduled),
      note: "Not started",
      tone: "neutral",
      icon: ClipboardCheck,
    },
    {
      title: "In progress",
      value: String(inProgress),
      note: "On the floor now",
      tone: "neutral",
      icon: ClipboardList,
    },
    {
      title: "Completed",
      value: String(completed),
      note: "Signed off",
      tone: "good",
      icon: CheckCheck,
    },
    {
      title: "Pieces short",
      value: String(short),
      note: short > 0 ? "Against the book stock" : "Nothing missing",
      tone: short > 0 ? "bad" : "good",
      icon: AlertTriangle,
      alert: short > 0,
    },
  ]

  const rows = counts
    .filter((count) => filter === "all" || count.status === filter)
    .filter((count) => {
      if (!q) return true
      return [count.id, count.area, count.owner, count.due].some((value) =>
        value.toLowerCase().includes(q)
      )
    })

  const pagination = usePagination(rows, { resetKey: `${q}|${filter}` })
  const active =
    rows.find((count) => count.id === selected) ?? rows[0] ?? null
  const lines = active ? countLines(active.location, active.counted) : []
  const summary = active
    ? countProgress(active.location, active.counted)
    : null

  function setLine(count: StockCount, sku: string, raw: string) {
    if (raw.trim() !== "") {
      const amount = Number.parseInt(raw, 10)
      if (!Number.isInteger(amount) || amount < 0) return
    }

    setCounts((current) =>
      current.map((item) => {
        if (item.id !== count.id) return item
        const counted = { ...item.counted }
        if (raw.trim() === "") delete counted[sku]
        else counted[sku] = Number.parseInt(raw, 10)
        const progress = countProgress(item.location, counted)
        const status =
          item.status === "completed" && progress.progress < 100
            ? "in_progress"
            : item.status !== "completed" && progress.done > 0
              ? "in_progress"
              : item.status
        return { ...item, counted, status }
      })
    )
    setSelected(count.id)
  }

  function start(count: StockCount) {
    setSelected(count.id)
    setFilter("all")
    if (count.status === "scheduled") {
      setCounts((current) =>
        current.map((item) =>
          item.id === count.id ? { ...item, status: "in_progress" } : item
        )
      )
    }
  }

  function markComplete(count: StockCount) {
    setSelected(count.id)
    setFilter("all")
    setCounts((current) =>
      current.map((item) =>
        item.id === count.id ? { ...item, status: "completed" } : item
      )
    )
  }

  function createCount(event: React.FormEvent) {
    event.preventDefault()
    if (!location || busy.has(location)) {
      setError("That area already has an open count.")
      return
    }
    if (!owner) {
      setError("Choose who is counting.")
      return
    }

    const nextNumber =
      counts.reduce((max, count) => {
        const value = Number(count.id.replace("CNT-", ""))
        return Number.isFinite(value) ? Math.max(max, value) : max
      }, 0) + 1
    const next: StockCount = {
      id: `CNT-${String(nextNumber).padStart(3, "0")}`,
      area: location,
      location,
      due,
      status: "scheduled",
      owner,
      counted: {},
    }
    setCounts((current) => [next, ...current])
    setSelected(next.id)
    setFilter("all")
    setError("")
    setOpen(false)
    const remaining = free.filter((area) => area !== location)
    setLocation(remaining[0] ?? "")
  }

  const columns: Column<StockCount>[] = [
    {
      key: "count",
      header: "Count",
      cell: (count) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{count.area}</span>
          <span className="text-xs text-muted-foreground">
            <span className="font-mono">{count.id}</span> · {count.owner}
          </span>
        </div>
      ),
    },
    {
      key: "due",
      header: "Due",
      cell: (count) => <span className="text-sm">{count.due}</span>,
    },
    {
      key: "progress",
      header: "Progress",
      cell: (count) => {
        const progress = countProgress(count.location, count.counted)
        return (
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">
              {progress.done}/{progress.styles}
            </span>
          </div>
        )
      },
    },
    {
      key: "status",
      header: "Status",
      cell: (count) => (
        <StatusBadge tone={TONE[count.status]}>
          {STATUS_LABEL[count.status]}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (count) => (
        <Button
          size="sm"
          variant="outline"
          className="h-8 rounded-sm px-3"
          onClick={() => start(count)}
        >
          {count.status === "scheduled"
            ? "Start"
            : count.status === "in_progress"
              ? "Continue"
              : "Review"}
        </Button>
      ),
    },
  ]

  const lineColumns: Column<CountLine>[] = [
    {
      key: "style",
      header: "Style",
      cell: (line) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{line.name}</span>
          <span className="text-xs text-muted-foreground">
            <span className="font-mono">{line.sku}</span> · {line.category}
          </span>
        </div>
      ),
    },
    {
      key: "expected",
      header: "Expected",
      align: "right",
      cell: (line) => (
        <span className="text-sm tabular-nums">{line.expected}</span>
      ),
    },
    {
      key: "counted",
      header: "Counted",
      align: "right",
      cell: (line) => (
        <div className="flex justify-end">
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            aria-label={`Counted ${line.name}`}
            value={line.counted === null ? "" : String(line.counted)}
            onChange={(event) =>
              active && setLine(active, line.sku, event.target.value)
            }
            className="h-8 w-20 text-right"
          />
        </div>
      ),
    },
    {
      key: "variance",
      header: "Variance",
      align: "right",
      cell: (line) => {
        if (line.counted === null) {
          return <span className="text-sm text-muted-foreground">—</span>
        }
        const variance = line.counted - line.expected
        return (
          <span
            className={cn(
              "text-sm tabular-nums",
              variance < 0 && "text-red-600 dark:text-red-400",
              variance > 0 && "text-amber-600 dark:text-amber-400",
              variance === 0 && "text-muted-foreground"
            )}
          >
            {variance > 0 ? `+${variance}` : variance}
          </span>
        )
      },
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Stock counts"
        description="Count what is on the floor and record what you find."
        actions={
          <Button
            className="rounded-sm"
            disabled={free.length === 0}
            onClick={() => {
              setLocation(free[0] ?? "")
              setError("")
              setOpen(true)
            }}
          >
            <Plus /> Start count
          </Button>
        }
      />

      <KpiStrip items={stats} />

      <FilterChips
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "All", count: counts.length },
          ...FILTERS.map((status) => ({
            value: status,
            label: STATUS_LABEL[status],
            count: counts.filter((count) => count.status === status).length,
          })),
        ]}
      />

      <DataTable
        columns={columns}
        rows={pagination.pageItems}
        rowKey={(count) => count.id}
        empty={
          <EmptyState
            icon={ClipboardCheck}
            title="No counts found"
            description="Try another status or search."
          />
        }
        footer={
          <TablePagination
            pagination={pagination}
            noun="counts"
            note={q ? `Search: “${q}”` : undefined}
          />
        }
      />

      {active && summary && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold">{active.area}</h3>
              <p className="text-xs text-muted-foreground">
                {active.owner} · {summary.done} of {summary.styles} styles ·{" "}
                {summary.units} units on the book
              </p>
            </div>
            {active.status !== "completed" && (
              <Button
                size="sm"
                className="rounded-sm"
                disabled={summary.progress < 100}
                onClick={() => markComplete(active)}
              >
                Mark complete
              </Button>
            )}
          </div>
          <DataTable
            columns={lineColumns}
            rows={lines}
            rowKey={(line) => line.sku}
            empty={
              <EmptyState
                icon={ClipboardList}
                title="Nothing is stored in this area"
              />
            }
          />
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <form onSubmit={createCount} className="flex flex-1 flex-col">
            <SheetHeader>
              <SheetTitle>Start a count</SheetTitle>
              <SheetDescription>
                Pick an area that does not already have an open count.
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-4 px-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="count-area">Area</Label>
                <select
                  id="count-area"
                  className={selectClass}
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                >
                  {free.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="count-due">Due</Label>
                <select
                  id="count-due"
                  className={selectClass}
                  value={due}
                  onChange={(event) => setDue(event.target.value)}
                >
                  {DUE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="count-owner">Counted by</Label>
                <select
                  id="count-owner"
                  className={selectClass}
                  value={owner}
                  onChange={(event) => setOwner(event.target.value)}
                >
                  {team.map((member) => (
                    <option key={member.id} value={member.name}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <SheetFooter>
              <Button type="submit" className="rounded-sm">
                Schedule count
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
