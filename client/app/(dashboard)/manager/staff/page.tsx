import { Users, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function StaffPage() {
  const staffMembers = [
    { id: 1, username: "manager_admin", role: "Manager", status: "Active" },
    { id: 2, username: "clerk_sarah", role: "Staff", status: "Active" },
  ]

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Management</h1>
          <p className="text-muted-foreground">Manage user accounts and permission roles.</p>
        </div>
        <Button><UserPlus className="mr-2 h-4 w-4" /> Add User</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>System Users</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Role Permission</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffMembers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono font-medium">{s.username}</TableCell>
                  <TableCell>
                    <Badge variant={s.role === "Manager" ? "default" : "secondary"}>{s.role}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center text-xs font-medium text-emerald-600">● {s.status}</span>
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