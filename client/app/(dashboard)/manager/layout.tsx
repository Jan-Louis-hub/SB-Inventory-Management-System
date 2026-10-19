import { DashboardShell } from "@/components/dashboard-shell"

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell role="inventory_manager">{children}</DashboardShell>
}