import {NextRequest, NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"
import {getSessionUser} from "@/lib/session"
import {audit} from "@/lib/audit"
import {rateLimit} from "@/lib/rate-limit"
import {describeMailConfig} from "@/lib/email-config"
import {sendRawEmail} from "@/lib/email"
import {renderEmailLayout} from "@/lib/email-template"

/** GET — текущая конфигурация почты (без ключей и паролей). */
export async function GET() {
    const admin = await getSessionUser()
    if (!admin || admin.role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403})

    return NextResponse.json(describeMailConfig())
}

/** POST — тестовое письмо тем же каналом, что и боевые уведомления. */
export async function POST(req: NextRequest) {
    const admin = await getSessionUser()
    if (!admin || admin.role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const rl = rateLimit(`email-test:${admin.email ?? "unknown"}`, 5, 60_000)
    if (!rl.ok) return NextResponse.json({error: "Слишком часто, попробуйте через минуту"}, {status: 429})

    const body = await req.json().catch(() => ({})) as { to?: unknown }
    const to = typeof body.to === "string" && body.to.trim() ? body.to.trim() : admin.email
    if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
        return NextResponse.json({error: "Укажите корректный адрес получателя"}, {status: 400})
    }

    const config = describeMailConfig()
    if (config.provider === "none") {
        return NextResponse.json(
            {error: "Почта не настроена: задайте RESEND_API_KEY или SMTP_HOST в .env", config},
            {status: 409},
        )
    }

    const html = renderEmailLayout({
        preheader: "Проверка почтового канала NEXUS",
        welcomeText: "Почта работает",
        bodyHtml: `
      <p class="text-body" style="text-align:left">
        Это тестовое письмо из админки NEXUS — отправлено тем же каналом, что и уведомления платформы.
      </p>
      <p class="link-copy" style="text-align:left">
        Канал: ${config.provider}<br/>
        Отправитель: ${config.from}<br/>
        Время: ${new Date().toLocaleString("ru-RU")}
      </p>
    `,
    })

    const result = await sendRawEmail({to, subject: "NEXUS — проверка почты", html, context: "admin_test"})

    const dbAdmin = await prisma.user.findUnique({where: {email: admin.email}, select: {id: true}})
    if (dbAdmin) {
        await audit(dbAdmin.id, "email_test_sent", "User", dbAdmin.id, {
            to: {to},
            provider: {to: result.provider},
            ok: {to: String(result.ok)},
        })
    }

    return NextResponse.json({...result, to, config}, {status: result.ok ? 200 : 502})
}
