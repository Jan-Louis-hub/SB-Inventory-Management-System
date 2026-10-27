"use client"

import { TrendingDown, TrendingUp } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { Panel } from "@/components/panel"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

// Garments received and sold at Harbour Lane, May to October.
const chartData = [
  { month: "May", stockIn: 90, stockOut: 78 },
  { month: "Jun", stockIn: 104, stockOut: 86 },
  { month: "Jul", stockIn: 88, stockOut: 70 },
  { month: "Aug", stockIn: 110, stockOut: 80 },
  { month: "Sep", stockIn: 86, stockOut: 98 },
  { month: "Oct", stockIn: 124, stockOut: 78 },
]

const chartConfig = {
  stockIn: { label: "Stock in", color: "var(--chart-1)" },
  stockOut: { label: "Stock out", color: "var(--chart-2)" },
} satisfies ChartConfig

// Net flow for the last 3 months vs the 3 before, calculated from the data
const net = (rows: typeof chartData) =>
  rows.reduce((sum, r) => sum + r.stockIn - r.stockOut, 0)
const recent = net(chartData.slice(3))
const previous = net(chartData.slice(0, 3))
const change = previous === 0 ? 0 : ((recent - previous) / Math.abs(previous)) * 100
const up = recent >= 0

export function StockFlowChart({
  className,
  href,
  linkLabel,
}: {
  className?: string
  href?: string
  linkLabel?: string
}) {
  return (
    <Panel
      title="Inventory flow"
      description="Stock in vs stock out, May to October"
      href={href}
      linkLabel={linkLabel}
      className={className}
    >
      <div className="p-4">
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
      </div>

      <div className="flex items-center gap-2 border-t bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
        {up ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
        <span>
          Net {up ? "+" : ""}
          {recent} units in the last 3 months, {change >= 0 ? "up" : "down"}{" "}
          {Math.abs(change).toFixed(1)}% on the 3 before
        </span>
      </div>
    </Panel>
  )
}