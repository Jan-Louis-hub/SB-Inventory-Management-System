import { Truck, Plus, Mail, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default function SuppliersPage() {
  const suppliers = [
    { id: 1, name: "AquaPure Distributors", contact: "John Smith", email: "orders@aquapure.co.za", phone: "+27 51 400 1234", items: 12 },
    { id: 2, name: "SnackWorld SA", contact: "Maria du Plessis", email: "sales@snackworld.co.za", phone: "+27 11 800 5678", items: 28 },
  ]

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground">Manage vendor relationships and supply chains.</p>
        </div>
        <Button><Plus className="mr-2 h-4 w-4" /> Add Supplier</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {suppliers.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {s.name}
                <Truck className="h-5 w-5 text-muted-foreground" />
              </CardTitle>
              <CardDescription>Contact: {s.contact}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><Mail className="h-4 w-4" /> {s.email}</div>
              <div className="flex items-center gap-2"><Phone className="h-4 w-4" /> {s.phone}</div>
              <div className="pt-2 font-medium text-foreground">Supplying {s.items} active products</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}