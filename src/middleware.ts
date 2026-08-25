import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Anyone opening the OLD IP link (172.16.7.24) gets the "we've moved" notice pointing to the new
// domain. Domain requests (Host = demoairrequest.nanyangtextile.com) pass through normally.
export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || ""
  if (host.startsWith("172.16.7.24") && !req.nextUrl.pathname.startsWith("/moved")) {
    const url = req.nextUrl.clone()
    url.pathname = "/moved"
    url.search = ""
    return NextResponse.rewrite(url)
  }
  return NextResponse.next()
}

// Skip static assets and API so only page views on the IP get the notice.
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|api|LOGO.png).*)"] }
