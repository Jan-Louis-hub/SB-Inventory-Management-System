import { NextRequest, NextResponse } from "next/server"

import { getBackendUrl } from "@/lib/auth-proxy"

type ExchangeResponse = {
  token?: string
  user?: { role: string }
}

function dashboardHome(role: string) {
  if (role === "inventory_manager") return "/manager"
  if (role === "stock_controller") return "/controller"
  return "/staff"
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  if (!code) {
    return NextResponse.redirect(new URL("/login?oauth=failed", request.url))
  }

  let upstream: Response
  try {
    upstream = await fetch(`${getBackendUrl()}/api/auth/oauth/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      cache: "no-store",
    })
  } catch {
    return NextResponse.redirect(new URL("/login?oauth=failed", request.url))
  }

  const result = (await upstream.json().catch(() => ({}))) as ExchangeResponse
  if (!upstream.ok || !result.token || !result.user) {
    return NextResponse.redirect(new URL("/login?oauth=failed", request.url))
  }

  const response = NextResponse.redirect(
    new URL(dashboardHome(result.user.role), request.url),
  )
  response.cookies.set("sb_inventory_session", result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60,
  })
  return response
}
