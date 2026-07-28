import { redirect } from "next/navigation"

export default function ProfilePage() {
  redirect("/work/community?tab=settings")
}
