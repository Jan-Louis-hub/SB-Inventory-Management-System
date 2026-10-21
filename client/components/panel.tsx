import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowUpRight } from "lucide-react"

import { cn } from "@/lib/utils"

export function Panel({
  title,
  description,
  href,
  linkLabel = "View all",
  className,
  children,
}: {
  title: string
  description?: string
  href?: string
  linkLabel?: string
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-sm border bg-card",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b bg-muted/40 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {href && (
          <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {linkLabel}
            <ArrowUpRight className="size-3.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}