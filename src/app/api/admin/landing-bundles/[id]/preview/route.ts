import {NextRequest, NextResponse} from "next/server"
import {getOrCreateDbUser, getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"
import {getDownloadUrl} from "@/lib/s3"
import {levelFromTestStep} from "@/lib/landing/specialist-level"
import {formatUserName} from "@/lib/user-name"

/**
 * Данные для предпросмотра сборки в модалке дизайнера — тот же формат (Designer),
 * что и на публичной главной (/api/landing/specialists), но для одной сборки
 * любого статуса, чтобы админ видел итоговую карточку ещё до одобрения.
 */

async function fileUrl(fileId: string | null): Promise<string | null> {
    if (!fileId) return null
    const file = await prisma.userFile.findUnique({where: {id: fileId}, select: {s3Key: true}})
    if (!file) return null
    try {
        const {url} = await getDownloadUrl(file.s3Key)
        return url
    } catch (error) {
        console.error("[admin/landing-bundles/preview] Failed to sign file", fileId, error)
        return null
    }
}

export async function GET(_req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})
    const dbUser = await getOrCreateDbUser(user)
    if (dbUser.role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const {id} = await params
    const bundle = await prisma.landingBundle.findUnique({
        where: {id},
        include: {
            user: {
                select: {
                    firstName: true,
                    lastName: true,
                    files: {
                        where: {category: "AVATAR"},
                        orderBy: {createdAt: "desc"},
                        take: 1,
                        select: {id: true},
                    },
                    specialistProfile: {
                        select: {
                            formData: true,
                            landingWorkPos: true,
                            steps: {where: {type: "TEST"}, select: {comment: true}},
                        },
                    },
                },
            },
            items: {orderBy: {position: "asc"}},
        },
    })
    if (!bundle) return NextResponse.json({error: "Not found"}, {status: 404})

    const profile = bundle.user.specialistProfile
    const level = levelFromTestStep(profile?.steps?.[0]?.comment ?? null)
    const fd = (profile?.formData as Record<string, string> | null) ?? {}

    const [avatar, work, introVideoUrl, ...portfolioUrls] = await Promise.all([
        fileUrl(bundle.user.files[0]?.id ?? null),
        fileUrl(bundle.workFileId),
        fileUrl(bundle.videoFileId),
        ...bundle.items.map((item) => fileUrl(item.fileId)),
    ])

    return NextResponse.json({
        id: bundle.id,
        name: formatUserName(bundle.user) || "Специалист",
        specialty: bundle.specialty ?? fd.specialty ?? fd.specialization ?? "",
        avatar,
        work,
        workPos: bundle.workPos ?? profile?.landingWorkPos ?? "center center",
        experience: parseInt(fd.experience ?? "0") || 0,
        sqm: parseInt(fd.sqm ?? "0") || 0,
        style: fd.interiorStyle ?? fd.specialty ?? fd.specialization ?? "",
        has3d: fd.has3d === "true",
        hasRd: fd.hasRd === "true",
        bio: bundle.about ?? fd.about ?? "",
        introVideoUrl,
        portfolioImages: portfolioUrls.filter(Boolean),
        level: level?.code ?? null,
        levelTitle: level?.title ?? null,
    })
}
