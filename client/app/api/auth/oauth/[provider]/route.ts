import { NextResponse } from "next/server"

import { getBackendUrl } from "@/lib/auth-proxy"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params
  if (provider !== "google" && provider !== "apple") {
    return NextResponse.json({ error: "Unsupported sign-in provider" }, { status: 404 })
  }

  const backendUrl = process.env.NEXT_PUBLIC_AUTH_API_URL ?? getBackendUrl()
  return NextResponse.redirect(
    new URL(`/api/auth/oauth/${provider}`, backendUrl),
  )
}
