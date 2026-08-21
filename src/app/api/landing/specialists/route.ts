import {NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"
import {getDownloadUrl} from "@/lib/s3"
import {levelFromTestStep, selectLandingCandidates} from "@/lib/landing/specialist-level"

export const dynamic = "force-dynamic"

/**
 * Слайды главной страницы — только реальные дизайнеры платформы с активным онбордингом.
 *
 * Источник слайда: одобренная админом сборка (LandingBundle), а если её нет — собственное
 * портфолио дизайнера (аватар + загруженные работы). Без фолбэка активный дизайнер с
 * заполненным портфолио не попадал на главную, пока не соберёт отдельную сборку.
 *
 * Порядок: закреплённые админом → выше квалификационный уровень → выше рейтинг → сначала
 * кураторские сборки.
 */

/** Сколько работ показываем в галерее слайда, если сборки нет (столько же, сколько даёт выбрать сборка). */
const FALLBACK_GALLERY_LIMIT = 20

/**
 * Категории файлов, из которых собирается слайд без сборки.
 * PORTRAIT — та же роль, что portraitFileId в LandingBundle: вертикальное фото дизайнера
 * на всю карточку. AVATAR — запасной вариант: это кроп 256×256 из кабинета, на карточке
 * он растягивается, но человек на слайде важнее идеального качества.
 */
const FALLBACK_FILE_CATEGORIES = ["PORTRAIT", "AVATAR", "LANDING_WORK", "PORTFOLIO"] as const

type ProfileForSlide = {
    rating: number | null
    formData: unknown
    landingWorkPos: string | null
    featuredOnLanding: boolean
    steps: { comment: string | null }[]
}

async function fileUrl(fileId: string | null): Promise<string | null> {
    if (!fileId) return null
    const file = await prisma.userFile.findUnique({where: {id: fileId}, select: {s3Key: true}})
    if (!file) return null
    const {url} = await getDownloadUrl(file.s3Key)
    return url
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
                            rating: true,
                            formData: true,
                            landingWorkPos: true,
                            featuredOnLanding: true,
                            steps: {where: {type: "TEST"}, select: {comment: true}},
                        },
                    },
                },
            },
            items: {orderBy: {position: "asc"}},
        },
        orderBy: {reviewedAt: "desc"},
    })

    // «С портфолио»: нужен портрет, обложка работы и хотя бы одна работа в галерее.
    const eligible = bundles.filter(b => b.portraitFileId && b.workFileId && b.items.length > 0)
    const curatedUserIds = new Set(eligible.map(b => b.userId))

    // Фолбэк: активные дизайнеры без готовой сборки, но с аватаром и загруженными работами.
    const fallbackUsers = await prisma.user.findMany({
        where: {
            role: "SPECIALIST",
            archivedAt: null,
            id: {notIn: [...curatedUserIds]},
            specialistProfile: {onboardingStatus: "ACTIVE"},
            files: {some: {category: "PORTFOLIO"}},
        },
        select: {
            id: true,
            name: true,
            specialistProfile: {
                select: {
                    rating: true,
                    formData: true,
                    landingWorkPos: true,
                    featuredOnLanding: true,
                    steps: {where: {type: "TEST"}, select: {comment: true}},
                },
            },
            files: {
                where: {category: {in: [...FALLBACK_FILE_CATEGORIES]}},
                select: {id: true, category: true, landingOrder: true, createdAt: true},
                orderBy: [{landingOrder: "asc"}, {createdAt: "asc"}],
            },
        },
    })

    const candidates = [
        ...eligible.map(b => ({
            kind: "bundle" as const,
            bundle: b,
            profile: b.user.specialistProfile as ProfileForSlide | null,
            level: levelFromTestStep(b.user.specialistProfile?.steps?.[0]?.comment ?? null),
            rating: b.user.specialistProfile?.rating ?? 0,
            featured: b.user.specialistProfile?.featuredOnLanding ?? false,
            curated: true,
        })),
        ...fallbackUsers
            .filter(u => u.files.some(f => f.category === "PORTFOLIO"))
            .map(u => ({
                kind: "portfolio" as const,
                user: u,
                profile: u.specialistProfile as ProfileForSlide | null,
                level: levelFromTestStep(u.specialistProfile?.steps?.[0]?.comment ?? null),
                rating: u.specialistProfile?.rating ?? 0,
                featured: u.specialistProfile?.featuredOnLanding ?? false,
                curated: false,
            })),
    ]

    // Ранжирование общее для обоих источников; при полном равенстве кураторская сборка выше.
    const selected = selectLandingCandidates(candidates)

    const slides = await Promise.all(
        selected.map(async (candidate) => {
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

            if (candidate.kind === "bundle") {
                const b = candidate.bundle
                const [portrait, work, introVideoUrl, ...portfolioUrls] = await Promise.all([
                    fileUrl(b.portraitFileId),
                    fileUrl(b.workFileId),
                    fileUrl(b.videoFileId),
                    ...b.items.map(item => fileUrl(item.fileId)),
                ])
                return {
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
            }

            // Фолбэк собираем по тем же ролям файлов, что и кураторская сборка.
            const u = candidate.user
            const firstId = (category: string) => u.files.find(f => f.category === category)?.id ?? null
            const portraitId = firstId("PORTRAIT") ?? firstId("AVATAR")
            const avatarId = firstId("AVATAR") ?? portraitId
            const workIds = u.files
                .filter(f => f.category === "LANDING_WORK" || f.category === "PORTFOLIO")
                .map(f => f.id)

            const [portrait, avatar, ...gallery] = await Promise.all([
                fileUrl(portraitId),
                fileUrl(avatarId),
                ...workIds.slice(0, FALLBACK_GALLERY_LIMIT).map(fileUrl),
            ])
            const images = gallery.filter((x): x is string => Boolean(x))
            if (images.length === 0) return null

            return {
                ...common,
                // Нет фото человека — карточкой становится работа, слайд всё равно осмысленный.
                portrait: portrait ?? images[0],
                avatar: avatar ?? portrait ?? images[0],
                work: images[0],
                workPos: profile?.landingWorkPos ?? "center center",
                name: u.name ?? fd.fullName ?? "Специалист",
                specialty: fd.specialty ?? fd.specialization ?? "",
                bio: fd.about ?? "",
                portfolioImages: images,
                introVideoUrl: null,
            }
        }),
    )

    return NextResponse.json(slides.filter(Boolean))
}
