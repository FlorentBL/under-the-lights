import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAdminRole } from "@/lib/admin-auth";
import { AdminPanel } from "./admin-panel";

export const metadata: Metadata = {
  title: "Control Room | Under the Lights",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !(await getAdminRole(session.user))) redirect("/");

  return <AdminPanel />;
}
