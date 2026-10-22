import { DashboardShell } from "@/components/dashboard-shell"
import { requireUserRole } from "@/lib/server-auth"

export const instant = false

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUserRole("staff_member")
  return (
    <DashboardShell role="staff_member" user={user}>
      {children}
    </DashboardShell>
  )
}