"use client"

import * as React from "react"
import Link from "next/link"
import { addDays, format, isSameDay } from "date-fns"
import { CalendarDays, Truck } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { money } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ROLE_VIEW, type Delivery, type DeliveryStatus } from "@/lib/deliveries"
import { listPurchaseOrders } from "@/lib/orders-api"
import type { Role } from "@/lib/roles"

const PRESETS = [
  { label: "Today", value: 0 },
  { label: "Tomorrow", value: 1 },
  { label: "In 3 days", value: 3 },
  { label: "In a week", value: 7 },
  { label: "In 2 weeks", value: 14 },
]

const STATUS_STYLES: Record<DeliveryStatus, string> = {
  scheduled: "bg-muted text-foreground",
  arrived: "bg-green-500/15 text-green-600 dark:text-green-400",
  delayed: "bg-red-500/15 text-red-600 dark:text-red-400",
  received: "bg-muted text-muted-foreground",
}

export function HeaderCalendar({ role }: { role: Role }) {
  const view = ROLE_VIEW[role]
  const [deliveries, setDeliveries] = React.useState<Delivery[]>([])
  const [loadError, setLoadError] = React.useState("")

  // Start empty: reading the current time during render breaks prerendering.
  // The effect below fills these in once the component is in the browser.
  const [mounted, setMounted] = React.useState(false)
  const [date, setDate] = React.useState<Date | undefined>(undefined)
  const [currentMonth, setCurrentMonth] = React.useState<Date | undefined>(
    undefined
  )

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      const now = new Date()
      setDate(now)
      setCurrentMonth(now)
      setMounted(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  React.useEffect(() => {
    if (!mounted) return
    const timer = window.setTimeout(() => {
      void listPurchaseOrders()
        .then((orders) => {
          const orderDeliveries: Delivery[] = orders
            .filter((order) => order.status !== "cancelled")
            .map((order): Delivery => ({
                id: order.purchase_number,
                supplier: order.supplier,
                items: order.items.map((item) => `${item.product_name} × ${item.quantity_ordered}`).join(", "),
                date: new Date(order.expected_date ?? order.order_date),
                status:
                  order.status === "received"
                    ? "received"
                    : order.status === "partial"
                      ? "arrived"
                      : "scheduled",
                ...(view.showValue ? { value: Number(order.total_amount) } : {}),
              }))
          setDeliveries(orderDeliveries.filter((delivery) => view.statuses.includes(delivery.status)))
          setLoadError("")
        })
        .catch((error: unknown) =>
          setLoadError(error instanceof Error ? error.message : "Could not load deliveries")
        )
    }, 0)
    return () => window.clearTimeout(timer)
  }, [mounted, role, view])

  const deliveryDates = deliveries.map((d) => d.date)
  const selectedDeliveries = date
    ? deliveries.filter((d) => isSameDay(d.date, date))
    : []

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Open delivery calendar"
        className={cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "size-9 shrink-0"
        )}
      >
        <CalendarDays className="size-4" />
      </PopoverTrigger>

      <PopoverContent
        align="end"
        collisionPadding={8}
        className="scroll-hidden max-h-[min(85svh,40rem)] w-[min(19rem,calc(100vw-1rem))] overflow-y-auto p-0"
      >
        <div className="flex justify-center p-3">
          {currentMonth && (
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              fixedWeeks
              modifiers={{ delivery: deliveryDates }}
              modifiersClassNames={{
                delivery:
                  "relative after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
              }}
              className="p-0 [--cell-size:--spacing(8)]"
            />
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 border-t px-3 py-2.5">
          {PRESETS.map((preset) => (
            <Button
              key={preset.value}
              variant="outline"
              size="sm"
              className="h-7 flex-1 px-2 text-xs"
              onClick={() => {
                const newDate = addDays(new Date(), preset.value)
                setDate(newDate)
                setCurrentMonth(newDate)
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        <div className="border-t p-3">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="text-xs font-medium">{view.title}</p>
            <p className="text-xs text-muted-foreground">
              {date ? format(date, "EEE, d MMM") : "Pick a date"}
            </p>
          </div>

          <div className="scroll-subtle max-h-[max(15svh,6rem)] overflow-y-auto pr-1">
            {selectedDeliveries.length === 0 ? (
              <p className="text-sm text-muted-foreground">{loadError || "No deliveries."}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {selectedDeliveries.map((d) => (
                  <li key={d.id} className="flex items-start gap-2 text-sm">
                    <Truck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{d.supplier}</span>
                        {view.showStatus && (
                          <span
                            className={cn(
                              "shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium capitalize",
                              STATUS_STYLES[d.status]
                            )}
                          >
                            {d.status}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {d.items}
                      </span>
                      {view.showValue && d.value !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          Order value: {money.format(d.value)}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {view.ordersHref && (
            <Link
              href={view.ordersHref}
              className="mt-3 inline-block text-xs underline underline-offset-4"
            >
              View orders
            </Link>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}