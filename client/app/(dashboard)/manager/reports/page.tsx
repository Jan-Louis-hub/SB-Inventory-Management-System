import { FileText, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Audit Logs</h1>
          <p className="text-muted-foreground">Export inventory statements and valuation logs.</p>
        </div>
        <Button><Download className="mr-2 h-4 w-4" /> Export CSV / PDF</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Stock Valuation Report</CardTitle>
            <CardDescription>Total monetary value of current warehouse inventory.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-3xl font-bold">R 482,500.00</div>
            <p className="text-sm text-muted-foreground">Calculated across 1,248 active units using FIFO pricing.</p>
            <Button variant="outline" size="sm"><FileText className="mr-2 h-4 w-4" /> View Full Breakdown</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stock Movement Audit Ledger</CardTitle>
            <CardDescription>Immutable record of all IN and OUT transactions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-3xl font-bold">342 Entries</div>
            <p className="text-sm text-muted-foreground">Logged by active managers and staff members this month.</p>
            <Button variant="outline" size="sm"><FileText className="mr-2 h-4 w-4" /> View Audit Trail</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}