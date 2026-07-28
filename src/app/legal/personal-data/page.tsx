import { redirect } from "next/navigation"

/** Старый путь; единая страница — `/privacy` */
export default function LegalPersonalDataRedirectPage() {
  redirect("/privacy")
}
