import { NextResponse } from "next/server"

import {
  clearSessionCookie,
  getBackendUrl,
  readSessionToken,
} from "@/lib/auth-proxy"

export async function GET() {
  const token = await readSessionToken()
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  let upstream: Response
  try {
    upstream = await fetch(`${getBackendUrl()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
  } catch {
    return NextResponse.json({ error: "The backend is unavailable" }, { status: 503 })
  }

  const result = await upstream.json().catch(() => ({}))
  const response = NextResponse.json(result, { status: upstream.status })
  if (upstream.status === 401) {
    clearSessionCookie(response)
  }
  return response
}
