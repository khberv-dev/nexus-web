import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"
import { getDownloadUrl } from "@/lib/s3"

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const key = req.nextUrl.searchParams.get("key")
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 })

  const { url } = await getDownloadUrl(key)
  return NextResponse.json({ url })
}
