import { DashboardShell } from "@/components/dashboard-shell"
import { requireUserRole } from "@/lib/server-auth"

export const instant = false

export default async function ControllerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUserRole("stock_controller")
  return (
    <DashboardShell role="stock_controller" user={user}>
      {children}
    </DashboardShell>
  )
}