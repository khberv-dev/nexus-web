import {NextRequest, NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"
import {getSessionUser} from "@/lib/session"
import {audit} from "@/lib/audit"
import {
    DEFAULT_REGULATIONS_TITLE,
    getRegulationsDocument,
    REGULATIONS_SLUG,
} from "@/lib/regulations"

const MAX_CONTENT_LENGTH = 200_000
const MAX_TITLE_LENGTH = 200

/** Текущий текст регламента (из БД либо дефолтный из кода). */
export async function GET() {
    const admin = await getSessionUser()
    if (!admin || admin.role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403})

    return NextResponse.json(await getRegulationsDocument())
}

/** Сохранение отредактированного администратором текста регламента (markdown). */
export async function PUT(req: NextRequest) {
    const admin = await getSessionUser()
    if (!admin || admin.role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const body = await req.json().catch(() => ({})) as { title?: unknown; content?: unknown }
    const content = typeof body.content === "string" ? body.content.trim() : ""
    const title = typeof body.title === "string" && body.title.trim()
        ? body.title.trim().slice(0, MAX_TITLE_LENGTH)
        : DEFAULT_REGULATIONS_TITLE

    if (!content) {
        return NextResponse.json({error: "Текст регламента не может быть пустым"}, {status: 400})
    }
    if (content.length > MAX_CONTENT_LENGTH) {
        return NextResponse.json(
            {error: `Текст слишком длинный: ${content.length} символов при лимите ${MAX_CONTENT_LENGTH}`},
            {status: 400},
        )
    }

    const dbAdmin = await prisma.user.findUnique({where: {email: admin.email}, select: {id: true}})
    const previous = await prisma.regulationDocument.findUnique({where: {slug: REGULATIONS_SLUG}})

    const saved = await prisma.regulationDocument.upsert({
        where: {slug: REGULATIONS_SLUG},
        create: {slug: REGULATIONS_SLUG, title, content, updatedById: dbAdmin?.id ?? null},
        update: {title, content, updatedById: dbAdmin?.id ?? null},
    })

    await audit(dbAdmin?.id ?? null, "regulations_updated", "RegulationDocument", saved.id, {
        title: {from: previous?.title, to: title},
        // Полный текст в историю не пишем — только размер, иначе лог раздувается.
        contentLength: {from: previous ? String(previous.content.length) : undefined, to: String(content.length)},
    })

    return NextResponse.json({ok: true, updatedAt: saved.updatedAt.toISOString()})
}
