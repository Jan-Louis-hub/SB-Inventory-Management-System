import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import {
  getBackendUrl,
} from "@/lib/auth-proxy"
import type { Role } from "@/lib/roles"

type AuthenticatedUser = {
  id: number
  name: string
  email: string
  role: Role
}

export async function requireUserRole(requiredRole: Role): Promise<AuthenticatedUser> {
  const token = (await cookies()).get("sb_inventory_session")?.value
  if (!token) {
    redirect("/login")
  }

  let response: Response
  try {
    response = await fetch(`${getBackendUrl()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
  } catch {
    redirect("/login?error=backend_unavailable")
  }

  if (!response.ok) {
    redirect("/login")
  }
  const result = (await response.json()) as { user: AuthenticatedUser }
  if (result.user.role !== requiredRole) {
    const home =
      result.user.role === "inventory_manager"
        ? "/manager"
        : result.user.role === "stock_controller"
          ? "/controller"
          : "/staff"
    redirect(home)
  }
  return result.user
}
