import {redirect} from "next/navigation"
import {legacyAdminClientRedirect} from "@/lib/admin-routes"
import {Icon} from "@/components/ui/icon"

export default async function AdminClientsPage({searchParams}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const legacy = legacyAdminClientRedirect(await searchParams)
    if (legacy) redirect(legacy)

    return (
        <div className="cl-detail-empty">
            <Icon name="user"/>
            <p>Выберите заказчика</p>
        </div>
    )
}
