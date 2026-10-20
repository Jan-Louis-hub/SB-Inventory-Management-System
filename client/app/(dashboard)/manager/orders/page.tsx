import { ShoppingCart, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function OrdersPage() {
  const orders = [
    { id: "PO-2026-001", supplier: "AquaPure Distributors", items: "Mineral Water (x200)", total: "R 3,000.00", status: "Delivered" },
    { id: "PO-2026-002", supplier: "SnackWorld SA", items: "Potato Chips (x100)", total: "R 2,250.00", status: "Pending" },
  ]

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-muted-foreground">Track restock orders placed with suppliers.</p>
        </div>
        <Button><Plus className="mr-2 h-4 w-4" /> Create Order</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Orders</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total Cost</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono font-medium">{o.id}</TableCell>
                  <TableCell>{o.supplier}</TableCell>
                  <TableCell>{o.items}</TableCell>
                  <TableCell className="text-right">{o.total}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={o.status === "Delivered" ? "default" : "secondary"}>{o.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}