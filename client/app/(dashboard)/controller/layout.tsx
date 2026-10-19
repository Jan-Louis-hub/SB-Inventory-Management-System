import { DashboardShell } from "@/components/dashboard-shell"

export default function ControllerLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell role="stock_controller">{children}</DashboardShell>
}