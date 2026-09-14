import {redirect} from "next/navigation"
import {legacyAdminOrderRedirect} from "@/lib/admin-routes"

export default async function AdminOrdersPage({searchParams}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const legacy = legacyAdminOrderRedirect(await searchParams)
    if (legacy) redirect(legacy)

    return (
        <div className="sp-detail">
            <div style={{textAlign: "center", color: "var(--adm-muted)", padding: "60px 0"}}>
                <i className="bx bx-folder-open" style={{fontSize: 48, opacity: 0.3, display: "block"}}/>
                <p style={{marginTop: 8}}>Выберите заказ</p>
            </div>
        </div>
    )
}
