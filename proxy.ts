import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminRole } from "@/lib/admin-auth";

export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !(await getAdminRole(session.user))) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
