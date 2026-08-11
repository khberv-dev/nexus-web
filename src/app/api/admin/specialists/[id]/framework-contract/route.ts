import {NextRequest, NextResponse} from "next/server"
import {getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"
import {getDownloadUrl, isStorageConfigured, putObject, validateFile} from "@/lib/s3"
import {SpecialistContractStatus} from "@prisma/client"

/** Админ: загрузить PDF договора с платформой для специалиста */
export async function POST(req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403})
    if (!isStorageConfigured()) return NextResponse.json({error: "Storage not configured"}, {status: 503})

    const {id: specialistUserId} = await params
    const db = await prisma.user.findFirst({
        where: {id: specialistUserId, role: "SPECIALIST"},
        include: {specialistProfile: true},
    })
    if (!db?.specialistProfile) return NextResponse.json({error: "Specialist not found"}, {status: 404})

    const form = await req.formData()
    const file = form.get("file")
    const numberRaw = form.get("number")
    if (!(file instanceof File) || file.size === 0) {
        return NextResponse.json({error: "Файл обязателен"}, {status: 400})
    }
    validateFile(file.name, file.size)
    const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
    if (ext !== "pdf") return NextResponse.json({error: "Нужен файл PDF"}, {status: 400})

    const buf = Buffer.from(await file.arrayBuffer())
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120)
    const key = `specialists/${specialistUserId}/platform-contract/${Date.now()}-${safe}`
    await putObject(key, buf, file.type || "application/pdf")

    const number =
        typeof numberRaw === "string" && numberRaw.trim()
            ? numberRaw.trim().slice(0, 64)
            : `СП-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${db.specialistProfile.id.slice(-4).toUpperCase()}`

    await prisma.specialistProfile.update({
        where: {id: db.specialistProfile.id},
        data: {
            specialistContractS3Key: key,
            specialistContractStatus: SpecialistContractStatus.AWAITING_SIGNATURE,
            specialistContractNumber: number,
            specialistContractUploadedAt: new Date(),
            specialistSignedContractS3Key: null,
            specialistSignedContractUploadedAt: null,
        } as never,
    })

    return NextResponse.json({ok: true, number})
}

/** Админ: статус и presigned URL на скачивание */
export async function GET(_req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const {id: specialistUserId} = await params
    const prof = await prisma.specialistProfile.findUnique({
        where: {userId: specialistUserId},
    })
    if (!prof) return NextResponse.json({error: "Not found"}, {status: 404})
    const profAny = prof as typeof prof & {
        specialistSignedContractS3Key?: string | null
        specialistSignedContractUploadedAt?: Date | null
    }

    let downloadUrl: string | null = null
    let signedDownloadUrl: string | null = null
    if (prof.specialistContractS3Key) {
        try {
            const {url} = await getDownloadUrl(prof.specialistContractS3Key)
            downloadUrl = url
        } catch {
            downloadUrl = null
        }
    }
    if (profAny.specialistSignedContractS3Key) {
        try {
            const {url} = await getDownloadUrl(profAny.specialistSignedContractS3Key)
            signedDownloadUrl = url
        } catch {
            signedDownloadUrl = null
        }
    }

    return NextResponse.json({
        status: prof.specialistContractStatus,
        number: prof.specialistContractNumber,
        hasFile: Boolean(prof.specialistContractS3Key),
        downloadUrl,
        uploadedAt: prof.specialistContractUploadedAt?.toISOString() ?? null,
        hasSignedFile: Boolean(profAny.specialistSignedContractS3Key),
        signedDownloadUrl,
        signedUploadedAt: profAny.specialistSignedContractUploadedAt?.toISOString() ?? null,
    })
}
