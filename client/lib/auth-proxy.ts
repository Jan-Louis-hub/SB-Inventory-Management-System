import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const backendUrl =
  process.env.BACKEND_API_URL?.replace(/\/+$/, "") ?? "http://localhost:8000"
const sessionCookie = "sb_inventory_session"
const sessionMaxAge = 12 * 60 * 60

type AuthResponse = {
  token?: string
  user?: {
    id: number
    name: string
    email: string
    role: string
  }
  error?: string
}

export async function forwardAuthRequest(request: Request, path: string) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "A JSON request body is required" }, { status: 400 })
  }

  let upstream: Response
  try {
    upstream = await fetch(`${backendUrl}/api/auth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    })
  } catch {
    return NextResponse.json(
      { error: "The backend is unavailable. Start the Flask server and try again." },
      { status: 503 },
    )
  }

  const result = (await upstream.json().catch(() => ({}))) as AuthResponse
  if (!upstream.ok) {
    return NextResponse.json(
      { error: result.error ?? "Authentication failed" },
      { status: upstream.status },
    )
  }
  if (!result.token || !result.user) {
    return NextResponse.json(
      { error: "The backend returned an invalid authentication response" },
      { status: 502 },
    )
  }

  const response = NextResponse.json({ user: result.user }, { status: upstream.status })
  response.cookies.set(sessionCookie, result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAge,
  })
  return response
}

export async function readSessionToken() {
  return (await cookies()).get(sessionCookie)?.value
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(sessionCookie, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
}

export function getBackendUrl() {
  return backendUrl
}
