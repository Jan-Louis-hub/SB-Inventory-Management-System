"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LogOut, Boxes } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { NAV, SETTINGS } from "@/lib/nav"
import { ROLES, type Role } from "@/lib/roles"

export function AppSidebar({ role }: { role: Role }) {
  const pathname = usePathname()
  const router = useRouter()
  const { home, label } = ROLES[role]

  // The overview link only matches exactly, others match their sub-pages too
  const isActive = (href: string) =>
    href === home ? pathname === href : pathname.startsWith(href)

  const settings = SETTINGS[role]

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href={home}>
                <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Boxes className="size-4" />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="font-semibold">SB Inventory</span>
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {NAV[role].map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    className="h-8 px-3"
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu className="gap-1">
          {settings && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActive(settings.href)}
                className="h-10 px-3"
              >
                <Link href={settings.href}>
                  <settings.icon />
                  <span>{settings.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-10 px-3"
              onClick={async () => {
                const response = await fetch("/api/auth/logout", {
                  method: "POST",
                })
                if (response.ok) {
                  router.replace("/login")
                  router.refresh()
                }
              }}
            >
              <LogOut />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}