import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Прямой чат заказчик↔дизайнер по этапу больше не используем.
  return NextResponse.json({ error: "Чат по этапу отключён. Используйте чат с администратором по заказу." }, { status: 410 })
  void _req
  void params
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Прямой чат заказчик↔дизайнер по этапу больше не используем.
  return NextResponse.json({ error: "Чат по этапу отключён. Используйте чат с администратором по заказу." }, { status: 410 })
  void req
  void params
}
