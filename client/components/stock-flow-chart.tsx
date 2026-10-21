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

// Placeholder data. Replace with your stock movement totals per month.
const chartData = [
  { month: "May", stockIn: 520, stockOut: 375 },
  { month: "Jun", stockIn: 610, stockOut: 400 },
  { month: "Jul", stockIn: 340, stockOut: 425 },
  { month: "Aug", stockIn: 580, stockOut: 390 },
  { month: "Sep", stockIn: 360, stockOut: 480 },
  { month: "Oct", stockIn: 640, stockOut: 410 },
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