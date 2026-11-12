import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname.toLowerCase();

  if (pathname === "/reference" || pathname.startsWith("/reference/") || pathname === "/design" || pathname.startsWith("/design/")) {
    return new NextResponse("Not found", { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/reference/:path*", "/design/:path*"],
};
