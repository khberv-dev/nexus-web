import {randomUUID} from "crypto"
import {NextRequest, NextResponse} from "next/server"
import {Prisma, StageStatus} from "@prisma/client"
import {z} from "zod"
import {prisma} from "@/lib/db/prisma"
import {audit} from "@/lib/audit"
import {notify} from "@/lib/notifications"
import {getSessionDbUser, getSessionUser} from "@/lib/session"
import {isStageImageFilename} from "@/lib/stage-file-helpers"
import type {StageType} from "@/app/orders/[id]/types"
import {STAGE_LABEL} from "@/app/orders/[id]/types"

const MAX_STAGE_CHAT_BODY = 8000

// Minimal W3C Web Annotation shape — each item must be a non-null object with type + target.
const annotationSchema = z.object({
    type: z.string(),
    target: z.unknown(),
}).passthrough()

const annotationsSchema = z.array(annotationSchema)

const patchBodySchema = z.object({
    annotations: annotationsSchema,
    notifyDesigner: z.boolean().optional(),
})

function extractAnnotationCommentTexts(annotations: unknown[]): string[] {
    const out: string[] = []
    const pushText = (s: string) => {
        const t = s.trim()
        if (t && !out.includes(t)) out.push(t)
    }
    const visitBody = (b: unknown) => {
        if (!b || typeof b !== "object") return
        const o = b as Record<string, unknown>
        if (typeof o.value === "string") {
            pushText(o.value)
            return
        }
        if (Array.isArray(o.body)) for (const x of o.body) visitBody(x)
    }
    for (const ann of annotations) {
        if (!ann || typeof ann !== "object") continue
        const a = ann as Record<string, unknown>
        const bodies = a.bodies
        if (Array.isArray(bodies)) {
            for (const b of bodies) {
                if (!b || typeof b !== "object") continue
                const bo = b as Record<string, unknown>
                if (bo.purpose === "commenting" && typeof bo.value === "string") pushText(bo.value)
            }
        }
        const body = a.body
        if (Array.isArray(body)) for (const x of body) visitBody(x)
        else if (body) visitBody(body)
    }
    return out
}

function buildDesignerChatBody(filename: string, texts: string[]): string {
    const header = `Пометки на изображении «${filename}» сохранены и отправлены дизайнеру.`
    if (!texts.length) return header
    const lines = texts.slice(0, 12).map((t, i) => `${i + 1}. ${t}`)
    const block = [header, "", "Комментарии к областям:", ...lines].join("\n")
    return block.length > MAX_STAGE_CHAT_BODY ? `${block.slice(0, MAX_STAGE_CHAT_BODY - 1)}…` : block
}

function isMissingStageChatRelation(error: unknown): boolean {
    const m = error instanceof Error ? error.message : String(error)
    return (
        /StageChatMessage/i.test(m) ||
        /42P01/.test(m) ||
        /relation .* does not exist/i.test(m) ||
        /no such table/i.test(m)
    )
}

async function authorizedFile(stageId: string, fileId: string, userId: string, role: string) {
    const file = await prisma.stageFile.findUnique({
        where: {id: fileId},
        include: {stage: {include: {order: true}}},
    })
    if (!file) return {error: "Not found" as const, status: 404 as const}
    const {order} = file.stage
    if (role === "CLIENT" && order.clientId !== userId) return {error: "Forbidden" as const, status: 403 as const}
    if (role === "SPECIALIST" && order.specialistId !== userId) return {
        error: "Forbidden" as const,
        status: 403 as const
    }
    if (role !== "CLIENT" && role !== "SPECIALIST" && role !== "ADMIN")
        return {error: "Forbidden" as const, status: 403 as const}
    if (!isStageImageFilename(file.filename)) return {error: "Not an image file" as const, status: 400 as const}
    return {file}
}

export async function GET(_req: NextRequest, {params}: { params: Promise<{ id: string; fid: string }> }) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})

    const {id: stageId, fid} = await params
    const res = await authorizedFile(stageId, fid, user.id, user.role)
    if ("error" in res) {
        if (res.status === 404) console.warn("[annotations] StageFile not found", {
            stageId,
            fid,
            role: user.role,
            userId: user.id
        })
        return NextResponse.json({error: res.error, stageId, fid}, {status: res.status})
    }

    const raw = res.file.annotations
    const annotations = Array.isArray(raw) ? raw : []
    return NextResponse.json({annotations})
}

export async function PATCH(req: NextRequest, {params}: { params: Promise<{ id: string; fid: string }> }) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})
    if (user.role !== "CLIENT") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const {id: stageId, fid} = await params
    const gate = await authorizedFile(stageId, fid, user.id, user.role)
    if ("error" in gate) {
        if (gate.status === 404) console.warn("[annotations] StageFile not found (PATCH)", {
            stageId,
            fid,
            role: user.role,
            userId: user.id
        })
        return NextResponse.json({error: gate.error, stageId, fid}, {status: gate.status})
    }

    if (gate.file.stage.status !== StageStatus.CLIENT_REVIEW) {
        return NextResponse.json({error: "Annotations editable only in CLIENT_REVIEW"}, {status: 409})
    }

    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({error: "Invalid JSON"}, {status: 400})
    }
    const parsed = patchBodySchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            {error: "Invalid body", details: parsed.error.flatten().fieldErrors},
            {status: 400},
        )
    }

    const {annotations: annotationList, notifyDesigner} = parsed.data

    await prisma.stageFile.update({
        where: {id: fid},
        data: {annotations: annotationList as Prisma.InputJsonValue},
    })

    if (notifyDesigner) {
        const dbUser = await getSessionDbUser(user)
        if (!dbUser) return NextResponse.json({error: "User not found"}, {status: 404})

        const texts = extractAnnotationCommentTexts(annotationList as unknown[])
        const preview = texts.length ? texts.slice(0, 5).join(" · ").slice(0, 420) : ""

        const chatBody = buildDesignerChatBody(gate.file.filename, texts)
        const msgId = randomUUID()
        try {
            await prisma.$executeRaw`
      INSERT INTO "StageChatMessage" ("id", "stageId", "senderId", body)
      VALUES (${msgId}, ${gate.file.stageId}, ${dbUser.id}, ${chatBody})
    `
        } catch (e) {
            console.error("[annotations] StageChatMessage INSERT failed:", e)
            if (isMissingStageChatRelation(e)) {
                return NextResponse.json(
                    {
                        error: "Пометки сохранены, но чат этапа не развёрнут в базе.",
                        hint: "Примените миграции: npm run db:deploy",
                    },
                    {status: 503},
                )
            }
            return NextResponse.json({error: "Не удалось записать сообщение в чат"}, {status: 500})
        }

        await audit(dbUser.id, "stage_file_annotations_saved", "StageFile", fid, {
            filename: {to: gate.file.filename},
            ...(preview ? {comments: {to: preview}} : {}),
        })

        const order = gate.file.stage.order
        const stageTitle = STAGE_LABEL[gate.file.stage.type as StageType] ?? gate.file.stage.type
        const shortOrder = order.id.slice(-6).toUpperCase()

        try {
            if (order.specialistId) {
                await notify(
                    order.specialistId,
                    "stage_chat",
                    `Пометки на изображении: ${stageTitle}`,
                    `Заказ #${shortOrder}: заказчик сохранил пометки на файле «${gate.file.filename}».`,
                    `/work/${order.id}`,
                )
            }
        } catch (e) {
            console.error("[annotations] notify specialist failed:", e)
        }
    }

    return NextResponse.json({ok: true})
}
