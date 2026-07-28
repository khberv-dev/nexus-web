import { DashboardLayout } from "@/components/app/DashboardLayout"
import { DashboardBreadcrumb } from "@/components/app/DashboardBreadcrumb"
import { getSessionUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { NAV_ITEMS } from "@/lib/nav"
import MvpKanban from "@/components/Kanban/MvpKanban"

export default async function MvpPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  return (
    <DashboardLayout navItems={NAV_ITEMS} userName={user.name ?? undefined} userEmail={user.email}>
      <DashboardBreadcrumb items={[
        { href: "/work", label: "Дашборд" },
        { href: "/work/mvp", label: "План MVP" },
      ]} />

      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="fw-semibold mb-1">План разработки MVP</h4>
          <p className="text-muted mb-0">Онлайн-платформа для дизайна интерьеров · 296 ч базовая оценка · 385 ч с буфером</p>
        </div>
      </div>

      <MvpKanban />
    </DashboardLayout>
  )
}
