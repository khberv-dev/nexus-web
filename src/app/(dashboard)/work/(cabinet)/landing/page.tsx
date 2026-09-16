import {redirect} from "next/navigation"
import {getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"
import {SpecialistLandingSection} from "@/components/Community/SpecialistCabinetSections"

export default async function SpecialistLandingPage() {
    const user = await getSessionUser()
    if (!user) redirect("/login")

    // Родительский layout кабинета не перемонтируется при переходе между разделами
    // (/work/orders, /work/portfolio, …), поэтому доступ к лендингу нельзя определять
    // по данным, загруженным там один раз — они могут быть устаревшими. Проверяем
    // портфолио заново при каждом заходе на вкладку «Лендинг».
    const portfolioProjectsCount = await prisma.portfolioProject.count({where: {userId: user.id}})

    return <SpecialistLandingSection portfolioProjectsCount={portfolioProjectsCount}/>
}
