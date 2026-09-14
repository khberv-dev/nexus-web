import {redirect} from "next/navigation"
import {specialistSectionHref} from "@/lib/cabinet-shell"

export default function ProfilePage() {
    redirect(specialistSectionHref("settings"))
}
