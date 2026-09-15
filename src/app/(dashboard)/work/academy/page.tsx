import {getSessionUser} from "@/lib/session"
import {redirect} from "next/navigation"
import "@/components/Community/Community.css"
import {DashMainLayout} from "@/components/dashboard-ui/DashMainLayout"
import {DashTopHeader} from "@/components/dashboard-ui/DashTopHeader"
import {buildSpecialistCabinetNavItems} from "@/components/Community/specialist-route-tabs"
import {SPECIALIST_CABINET_LOGO_HREF} from "@/lib/cabinet-shell"
import AcademyPage from "@/components/Academy/AcademyPage"
import Link from "next/link"

export default async function Academy() {
    const user = await getSessionUser()
    if (!user) redirect("/login")

    return (
        <div className="dash">
            <DashTopHeader
                email={user.email}
                name={user.name}
                title="Академия"
                logoHref={SPECIALIST_CABINET_LOGO_HREF}
                navItems={buildSpecialistCabinetNavItems("")}
                primaryAction={{
                    href: SPECIALIST_CABINET_LOGO_HREF,
                    label: "К профилю",
                    iconClassName: "bx bx-arrow-back"
                }}
            />
            <DashMainLayout>
                <Link href={SPECIALIST_CABINET_LOGO_HREF} style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: "0.78rem",
                    color: "var(--dash-muted)",
                    textDecoration: "none",
                    marginBottom: 12
                }}>
                    <i className="bx bx-arrow-back"/> Кабинет
                </Link>
                <AcademyPage/>
            </DashMainLayout>
        </div>
    )
}
