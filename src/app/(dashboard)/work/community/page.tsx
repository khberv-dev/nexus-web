import {redirect} from "next/navigation"
import {SPECIALIST_CABINET_SECTIONS, type SpecialistCabinetSection, specialistSectionHref} from "@/lib/cabinet-shell"

/** Старый кабинет с вкладками `?tab=` → разделы /work/<section>. */
export default async function LegacyCommunityPage({searchParams}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const {tab} = await searchParams
    const section = (SPECIALIST_CABINET_SECTIONS as readonly unknown[]).includes(tab)
        ? tab as SpecialistCabinetSection
        : "orders"
    redirect(specialistSectionHref(section))
}
