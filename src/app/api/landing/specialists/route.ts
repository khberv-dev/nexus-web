import {NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"
import {getDownloadUrl} from "@/lib/s3"
import {levelFromTestStep} from "@/lib/landing/specialist-level"

export const dynamic = "force-dynamic"

/**
 * Слайды главной страницы — только реальные дизайнеры платформы с активным онбордингом.
 *
 * Источник слайда: только одобренная администратором сборка (LandingBundle).
 * Файлы портфолио доступны на главной лишь тогда, когда специалист явно добавил их
 * в эту сборку: напрямую собирать профиль из портфолио здесь нельзя.
 *
 * Все одобренные сборки показываются в порядке последней модерации.
 */

type ProfileForSlide = {
    formData: unknown
    landingWorkPos: string | null
    steps: { comment: string | null }[]
}

async function fileUrl(fileId: string | null): Promise<string | null> {
    if (!fileId) return null
    const file = await prisma.userFile.findUnique({where: {id: fileId}, select: {s3Key: true}})
    if (!file) return null
    try {
        const {url} = await getDownloadUrl(file.s3Key)
        return url
    } catch (error) {
        console.error("[landing/specialists] Failed to sign file", fileId, error)
        return null
    }
}

export async function GET() {
    const bundles = await prisma.landingBundle.findMany({
        where: {
            status: "APPROVED",
            // Архивированный или недоведённый до ACTIVE дизайнер не должен светиться на главной,
            // даже если его сборка когда-то была одобрена.
            user: {
                archivedAt: null,
                role: "SPECIALIST",
                specialistProfile: {onboardingStatus: "ACTIVE"},
            },
        },
        include: {
            user: {
                select: {
                    name: true,
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
        orderBy: {reviewedAt: "desc"},
    })

    // Портрет и обложка обязательны при отправке на модерацию. Проверка здесь защищает
    // публичную страницу от старых или повреждённых записей; галерея при этом необязательна.
    const eligible = bundles.filter(b => b.portraitFileId && b.workFileId)

    const candidates = [
        ...eligible.map(b => ({
            bundle: b,
            profile: b.user.specialistProfile as ProfileForSlide | null,
            level: levelFromTestStep(b.user.specialistProfile?.steps?.[0]?.comment ?? null),
        })),
    ]

    const slides = await Promise.all(
        candidates.map(async (candidate) => {
            const {level, profile} = candidate
            const fd = (profile?.formData as Record<string, string> | null) ?? {}
            const common = {
                sqm: parseInt(fd.sqm ?? "0") || 0,
                experience: parseInt(fd.experience ?? "0") || 0,
                style: fd.interiorStyle ?? fd.specialty ?? fd.specialization ?? "",
                has3d: fd.has3d === "true",
                hasRd: fd.hasRd === "true",
                level: level?.code ?? null,
                levelTitle: level?.title ?? null,
            }

            const b = candidate.bundle
            const [portrait, work, introVideoUrl, ...portfolioUrls] = await Promise.all([
                fileUrl(b.portraitFileId),
                fileUrl(b.workFileId),
                fileUrl(b.videoFileId),
                ...b.items.map(item => fileUrl(item.fileId)),
            ])
            return {
                id: b.id,
                ...common,
                portrait,
                avatar: portrait,
                work,
                workPos: b.workPos ?? profile?.landingWorkPos ?? "center center",
                name: b.user.name ?? fd.fullName ?? "Специалист",
                specialty: b.specialty ?? fd.specialty ?? fd.specialization ?? "",
                bio: b.about ?? fd.about ?? "",
                portfolioImages: portfolioUrls.filter(Boolean),
                introVideoUrl,
            }
        }),
    )

    return NextResponse.json(slides.filter((slide) => slide.portrait && slide.work), {
        headers: {"Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300"},
    })
}
