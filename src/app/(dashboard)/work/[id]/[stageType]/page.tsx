import {redirect} from "next/navigation"
import {specialistOrderHref} from "@/lib/cabinet-shell"

/** Старый адрес этапа (/work/:id/:stageType) — на него ведут письма и уведомления, уже сохранённые в БД. */
export default async function LegacyWorkStagePage({params}: {
    params: Promise<{ id: string; stageType: string }>
}) {
    const {id, stageType} = await params
    redirect(specialistOrderHref(id, stageType))
}
