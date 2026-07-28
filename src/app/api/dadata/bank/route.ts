import { NextRequest, NextResponse } from "next/server"
import { rateLimit } from "@/lib/rate-limit"
import { getSessionUser } from "@/lib/session"

export async function POST(req: NextRequest) {
  // This proxies a paid external API with a server-side token — require auth and
  // rate-limit per user so it can't be abused anonymously (SEC6).
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rl = rateLimit(`dadata:${user.id}`, 30, 60 * 60 * 1000)
  if (!rl.ok) return NextResponse.json({ error: "Слишком много запросов. Попробуйте позже." }, { status: 429 })

  const { bik } = await req.json()
  if (!bik) return NextResponse.json({ error: "bik required" }, { status: 400 })

  let res: Response
  try {
    res = await fetch("https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/bank", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${process.env.DADATA_API}`,
      },
      body: JSON.stringify({ query: bik }),
      cache: "no-store",
    })
  } catch {
    // Network/DNS issues should not break onboarding form
    return NextResponse.json({ found: false, degraded: true }, { status: 200 })
  }

  if (!res.ok) return NextResponse.json({ error: "DaData error" }, { status: 502 })
  const data = await res.json()
  const s = data.suggestions?.[0]
  if (!s) return NextResponse.json({ found: false })

  return NextResponse.json({
    found: true,
    bankName: s.value,
    corrAccount: s.data?.correspondent_account ?? "",
  })
}
