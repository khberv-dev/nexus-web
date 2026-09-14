import {redirect} from "next/navigation"
import {legacyAdminSpecialistRedirect} from "@/lib/admin-routes"

export default async function AdminSpecialistsPage({searchParams}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const legacy = legacyAdminSpecialistRedirect(await searchParams)
    if (legacy) redirect(legacy)

    return (
        <div className="sp-detail-empty">
            <i className="bx bx-user-circle"/>
            <p>Выберите специалиста</p>
        </div>
    )
}
