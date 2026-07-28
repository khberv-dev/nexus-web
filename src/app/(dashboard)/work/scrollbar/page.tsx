import { NAV_ITEMS } from "@/lib/nav"
import { DashboardLayout } from "@/components/app/DashboardLayout"
import { DashboardBreadcrumb } from "@/components/app/DashboardBreadcrumb"
import { getSessionUser } from "@/lib/session"
import { redirect } from "next/navigation"
import PerfectScrollbarDemo from "./PerfectScrollbarDemo"

export default async function ScrollbarPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  return (
    <DashboardLayout navItems={NAV_ITEMS} userName={user.name ?? undefined} userEmail={user.email}>
      <DashboardBreadcrumb items={[
        { href: "/work", label: "Дашборд" },
        { href: "/work/scrollbar", label: "Perfect Scrollbar" },
      ]} />
      <PerfectScrollbarDemo />
    </DashboardLayout>
  )
}
