import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { AdminLayout } from "@/components/admin/AdminLayout"
import LandingBundlesClient from "./LandingBundlesClient"

export default async function AdminLandingPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (user.role !== "ADMIN") redirect("/login")

  return (
    <AdminLayout>
      <LandingBundlesClient />
    </AdminLayout>
  )
}
