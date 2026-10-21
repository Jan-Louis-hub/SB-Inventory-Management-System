"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

export type PaginationState = {
  page: number
  pageSize: number
  totalPages: number
  total: number
  from: number
  to: number
  setPage: (page: number) => void
  setPageSize: (size: number) => void
}

// Pass a resetKey (for example the search + filters joined together).
// When it changes, the list jumps back to page 1.
export function usePagination<T>(
  items: T[],
  { initialPageSize = 10, resetKey = "" }: { initialPageSize?: number; resetKey?: string } = {}
): PaginationState & { pageItems: T[] } {
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSizeState] = React.useState(initialPageSize)

  const [prevKey, setPrevKey] = React.useState(resetKey)
  if (resetKey !== prevKey) {
    setPrevKey(resetKey)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const current = Math.min(page, totalPages)
  const start = (current - 1) * pageSize
  const pageItems = items.slice(start, start + pageSize)

  return {
    page: current,
    pageSize,
    totalPages,
    total: items.length,
    from: items.length === 0 ? 0 : start + 1,
    to: start + pageItems.length,
    pageItems,
    setPage,
    setPageSize: (size) => {
      setPageSizeState(size)
      setPage(1)
    },
  }
}

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

const pageButton =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-sm border px-2 text-xs tabular-nums transition-colors"

export function TablePagination({
  pagination: p,
  noun = "items",
  note,
  pageSizes = [5, 10, 20],
}: {
  pagination: PaginationState
  noun?: string
  note?: string
  pageSizes?: number[]
}) {
  return (
    <div className="flex flex-col gap-3 border-t bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span>
          Showing {p.from}–{p.to} of {p.total} {noun}
          {note && <> · {note}</>}
        </span>

        <label className="flex items-center gap-2">
          Rows per page
          <select
            value={p.pageSize}
            onChange={(e) => p.setPageSize(Number(e.target.value))}
            className="h-8 rounded-sm border bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {pageSizes.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {p.totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous page"
            disabled={p.page === 1}
            onClick={() => p.setPage(p.page - 1)}
            className={cn(
              pageButton,
              "hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            )}
          >
            <ChevronLeft className="size-4" />
          </button>

          <span className="px-2 sm:hidden">
            Page {p.page} of {p.totalPages}
          </span>

          <div className="hidden items-center gap-1 sm:flex">
            {getPageItems(p.page, p.totalPages).map((item, i) =>
              item === "…" ? (
                <span key={`gap-${i}`} className="px-1">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  aria-label={`Page ${item}`}
                  aria-current={item === p.page ? "page" : undefined}
                  onClick={() => p.setPage(item)}
                  className={cn(
                    pageButton,
                    item === p.page
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
            disabled={p.page === p.totalPages}
            onClick={() => p.setPage(p.page + 1)}
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
  )
}