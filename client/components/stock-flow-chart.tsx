"use client"

import * as React from "react"
import { TrendingDown, TrendingUp } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { Panel } from "@/components/panel"
import { listStockMovements } from "@/lib/inventory-api"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const chartConfig = {
  stockIn: { label: "Stock in", color: "var(--chart-1)" },
  stockOut: { label: "Stock out", color: "var(--chart-2)" },
} satisfies ChartConfig

// Net flow for the last 3 months vs the 3 before, calculated from the data
export function StockFlowChart({
  className,
  href,
  linkLabel,
}: {
  className?: string
  href?: string
  linkLabel?: string
}) {
  const [chartData, setChartData] = React.useState<
    { month: string; stockIn: number; stockOut: number }[]
  >([])
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void listStockMovements()
        .then((movements) => {
          const monthly = new Map<string, { month: string; stockIn: number; stockOut: number }>()
          for (const movement of movements) {
            const date = new Date(movement.created_at)
            const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, "0")}`
            const row = monthly.get(key) ?? {
              month: date.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
              stockIn: 0,
              stockOut: 0,
            }
            if (movement.quantity_change > 0) row.stockIn += movement.quantity_change
            else row.stockOut += Math.abs(movement.quantity_change)
            monthly.set(key, row)
          }
          setChartData([...monthly.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, row]) => row))
          setError("")
        })
        .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load movement history"))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const net = (rows: typeof chartData) =>
    rows.reduce((sum, row) => sum + row.stockIn - row.stockOut, 0)
  const recent = net(chartData.slice(-3))
  const previous = net(chartData.slice(-6, -3))
  const change = previous === 0 ? 0 : ((recent - previous) / Math.abs(previous)) * 100
  const up = recent >= 0

  return (
    <Panel
      title="Inventory flow"
      description="Stock received and issued from recorded movements"
      href={href}
      linkLabel={linkLabel}
      className={className}
    >
      <div className="p-4">
        {chartData.length ? (
          <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
          <BarChart accessibilityLayer data={chartData} barGap={4}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
            />
            <YAxis tickLine={false} axisLine={false} width={36} />
            <ChartTooltip
              cursor={{ fill: "var(--muted)", opacity: 0.4 }}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="stockIn" fill="var(--color-stockIn)" radius={[2, 2, 0, 0]} />
            <Bar dataKey="stockOut" fill="var(--color-stockOut)" radius={[2, 2, 0, 0]} />
          </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            {error || "No inventory movement history yet."}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
        {chartData.length > 0 ? (
          <>
            {up ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
            <span>
              Net {up ? "+" : ""}
              {recent} units in the last 3 months, {change >= 0 ? "up" : "down"}{" "}
              {Math.abs(change).toFixed(1)}% on the 3 before
            </span>
          </>
        ) : <span>Movement summaries will appear after stock activity is recorded.</span>}
      </div>
    </Panel>
  )
}