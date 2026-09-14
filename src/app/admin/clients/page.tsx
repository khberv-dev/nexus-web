import {redirect} from "next/navigation"
import {legacyAdminClientRedirect} from "@/lib/admin-routes"

export default async function AdminClientsPage({searchParams}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const legacy = legacyAdminClientRedirect(await searchParams)
    if (legacy) redirect(legacy)

    return (
        <div className="cl-detail-empty">
            <i className="bx bx-user"/>
            <p>Выберите заказчика</p>
        </div>
    )
}
