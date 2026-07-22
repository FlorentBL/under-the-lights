import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const access = await requireAdmin(request);

  return NextResponse.json({ admin: access.ok });
}
