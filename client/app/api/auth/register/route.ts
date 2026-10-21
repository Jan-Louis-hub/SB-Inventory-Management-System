import { forwardAuthRequest } from "@/lib/auth-proxy"

export async function POST(request: Request) {
  return forwardAuthRequest(request, "register")
}
