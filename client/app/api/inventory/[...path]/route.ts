import { NextResponse } from "next/server"

import { getBackendUrl, readSessionToken } from "@/lib/auth-proxy"

type RouteContext = { params: Promise<{ path: string[] }> }

async function forward(request: Request, context: RouteContext) {
  const token = await readSessionToken()
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  const { path } = await context.params
  const pathname = path.map(encodeURIComponent).join("/")
  const url = new URL(request.url)
  let upstream: Response
  try {
    upstream = await fetch(
      `${getBackendUrl()}/api/${pathname}${url.search}`,
      {
        method: request.method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(request.headers.get("content-type")
            ? { "Content-Type": request.headers.get("content-type")! }
            : {}),
        },
        ...(request.method === "GET" || request.method === "HEAD"
          ? {}
          : { body: await request.text() }),
        cache: "no-store",
      }
    )
  } catch {
    return NextResponse.json({ error: "The backend is unavailable" }, { status: 503 })
  }

  const body = await upstream.text()
  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
    },
  })
}

export const GET = forward
export const POST = forward
export const PATCH = forward
export const PUT = forward
export const DELETE = forward
