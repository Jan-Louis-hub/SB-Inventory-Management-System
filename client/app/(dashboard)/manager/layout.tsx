import { DashboardShell } from "@/components/dashboard-shell"
import { requireUserRole } from "@/lib/server-auth"

export const instant = false

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUserRole("inventory_manager")
  return (
    <DashboardShell role="inventory_manager" user={user}>
      {children}
    </DashboardShell>
  )
}