import { AppSidebar } from "@/components/app-sidebar"
import { Header } from "@/components/header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { ROLES, type Role } from "@/lib/roles"

export function DashboardShell({
  role,
  children,
}: {
  role: Role
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <AppSidebar role={role} />
      <SidebarInset>
        <Header title={ROLES[role].label} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}