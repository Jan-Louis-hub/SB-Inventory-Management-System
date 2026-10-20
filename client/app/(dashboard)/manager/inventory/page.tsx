import Link from "next/link"
import { Plus, Search, Filter, AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function InventoryPage() {
  const products = [
    { id: 1, sku: "BEV-001", name: "Sparkling Mineral Water 500ml", category: "Beverages", price: "R 15.00", stock: 120, min: 20 },
    { id: 2, sku: "SNK-001", name: "Artisanal Potato Chips 125g", category: "Snacks", price: "R 22.50", stock: 45, min: 15 },
    { id: 3, sku: "STA-001", name: "A4 Hardcover Notebook 192p", category: "Stationery", price: "R 45.00", stock: 8, min: 10 },
  ]

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Catalog</h1>
          <p className="text-muted-foreground">Manage products, pricing, and safety stock levels.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add New Product
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Products</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search SKU or name..." className="pl-8 w-[250px]" />
              </div>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" /> Filter
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Current Stock</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => {
                const isLow = p.stock <= p.min
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.category}</TableCell>
                    <TableCell className="text-right">{p.price}</TableCell>
                    <TableCell className="text-right font-bold">{p.stock}</TableCell>
                    <TableCell className="text-center">
                      {isLow ? (
                        <Badge variant="destructive">Low Stock</Badge>
                      ) : (
                        <Badge variant="outline">Healthy</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}