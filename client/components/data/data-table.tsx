import type { ReactNode } from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type Column<T> = {
  key: string
  header: string
  align?: "left" | "right"
  cell: (row: T) => ReactNode
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  footer,
  className,
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  empty: ReactNode
  footer?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("overflow-hidden rounded-sm border bg-card", className)}>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            {columns.map((c) => (
              <TableHead
                key={c.key}
                className={cn(
                  "h-10 px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground",
                  c.align === "right" && "text-right"
                )}
              >
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="h-48">
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={rowKey(row)} className="hover:bg-muted/30">
                {columns.map((c) => (
                  <TableCell
                    key={c.key}
                    className={cn(
                      "px-4 py-3",
                      c.align === "right" && "text-right"
                    )}
                  >
                    {c.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {footer}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 text-center">
      <div className="flex size-10 items-center justify-center rounded-sm bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  )
}