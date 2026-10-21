import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { HeaderSearch } from "@/components/header-search"
import { HeaderCalendar } from "@/components/header-calendar"
import { UserMenu } from "@/components/user-menu"
import { ROLES, type Role } from "@/lib/roles"

export function Header({ title, role }: { title: string; role: Role }) {
  const { home, label } = ROLES[role]

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <h1 className="text-sm font-medium">{title}</h1>
      <div className="ml-auto flex w-full max-w-xl items-center gap-3">
        <HeaderSearch />
        <HeaderCalendar role={role} />
        <UserMenu home={home} roleLabel={label} />
      </div>
    </header>
  )
}