import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const backendUrl =
  process.env.BACKEND_API_URL?.replace(/\/+$/, "") ?? "http://localhost:8000"
const sessionCookie = "sb_inventory_session"
const sessionMaxAge = 12 * 60 * 60
const mockSessionPrefix = "mock-development:"

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

type MockUser = {
  id: number
  name: string
  email: string
  role: "inventory_manager" | "stock_controller" | "staff_member"
}

export function isMockAuthEnabled() {
  return process.env.USE_MOCK_AUTH === "true" && process.env.NODE_ENV !== "production"
}

function mockUserForRole(role: MockUser["role"], email: string): MockUser {
  const names: Record<MockUser["role"], string> = {
    inventory_manager: "Demo Manager",
    stock_controller: "Demo Controller",
    staff_member: "Demo Staff Member",
  }

  return { id: 1, name: names[role], email, role }
}

export function getMockUserFromSessionToken(token?: string): MockUser | null {
  if (!token?.startsWith(mockSessionPrefix)) return null

  const role = token.slice(mockSessionPrefix.length)
  if (
    role !== "inventory_manager" &&
    role !== "stock_controller" &&
    role !== "staff_member"
  ) {
    return null
  }

  return mockUserForRole(role, `${role}@demo.local`)
}

export async function forwardAuthRequest(request: Request, path: string) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "A JSON request body is required" }, { status: 400 })
  }

  if (path === "login" && isMockAuthEnabled()) {
    if (
      typeof body !== "object" ||
      body === null ||
      !("email" in body) ||
      typeof body.email !== "string" ||
      !body.email.trim() ||
      !("password" in body) ||
      typeof body.password !== "string" ||
      !body.password
    ) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    const email = body.email.trim()
    const localPart = email.split("@", 1)[0].toLowerCase()
    const role =
      localPart === "staff"
        ? "staff_member"
        : localPart === "controller"
          ? "stock_controller"
          : "inventory_manager"
    const user = mockUserForRole(role, email)
    const response = NextResponse.json({ user, mockAuth: true })
    response.cookies.set(sessionCookie, `${mockSessionPrefix}${role}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: sessionMaxAge,
    })
    return response
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
