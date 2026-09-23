import {redirect} from "next/navigation"
import {legacyAdminSpecialistRedirect} from "@/lib/admin-routes"
import {Icon} from "@/components/ui/icon"

export default async function AdminSpecialistsPage({searchParams}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const legacy = legacyAdminSpecialistRedirect(await searchParams)
    if (legacy) redirect(legacy)

    return (
        <div className="sp-detail-empty">
            <Icon name="user-circle"/>
            <p>Выберите специалиста</p>
        </div>
    )
}
