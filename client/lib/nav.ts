import {
  ArrowLeftRight,
  BarChart3,
  ClipboardCheck,
  Inbox,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react"
import type { Role } from "@/lib/roles"

export type NavItem = { title: string; href: string; icon: LucideIcon }

export const NAV: Record<Role, NavItem[]> = {
  inventory_manager: [
    { title: "Overview", href: "/manager", icon: LayoutDashboard },
    { title: "Inventory", href: "/manager/inventory", icon: Package },
    { title: "Suppliers", href: "/manager/suppliers", icon: Truck },
    { title: "Orders", href: "/manager/orders", icon: ShoppingCart },
    { title: "Reports", href: "/manager/reports", icon: BarChart3 },
    { title: "Staff", href: "/manager/staff", icon: Users },
  ],
  stock_controller: [
    { title: "Overview", href: "/controller", icon: LayoutDashboard },
    { title: "Stock", href: "/controller/stock", icon: ArrowLeftRight },
    { title: "Orders", href: "/controller/orders", icon: ShoppingCart },
    { title: "Stock counts", href: "/controller/counts", icon: ClipboardCheck },
  ],
  staff_member: [
    { title: "Overview", href: "/staff", icon: LayoutDashboard },
    { title: "Inventory", href: "/staff/inventory", icon: Package },
    { title: "Requests", href: "/staff/requests", icon: Inbox },
  ],
}

// Pinned to the bottom of the sidebar, above Log out.
export const SETTINGS: Partial<Record<Role, NavItem>> = {
  inventory_manager: {
    title: "Settings",
    href: "/manager/settings",
    icon: Settings,
  },
}