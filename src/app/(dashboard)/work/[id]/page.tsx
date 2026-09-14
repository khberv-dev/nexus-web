import {redirect} from "next/navigation"
import {specialistOrderHref} from "@/lib/cabinet-shell"

/** Старый адрес заказа (/work/:id) — на него ведут письма и уведомления, уже сохранённые в БД. */
export default async function LegacyWorkOrderPage({params}: { params: Promise<{ id: string }> }) {
    const {id} = await params
    redirect(specialistOrderHref(id))
}
