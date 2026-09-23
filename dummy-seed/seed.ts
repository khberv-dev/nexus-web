/**
 * Наполняет БД одиннадцатью специалистами уровня Elite из nexus-dummy/ (см. designers.json):
 * пользователь + активный онбординг + пройденный тест L1-L4, аватар, портфолио-проект
 * с работами, и одобренная сборка для лендинга (LandingBundle APPROVED) — то есть эти
 * карточки сразу появляются на главной странице.
 *
 * Отдельный опциональный скрипт, не часть `npm run db:seed` / `db:reset:demo`
 * (prisma.config.ts указывает на prisma/seed.ts, этот файл туда не подключён).
 *
 * Запуск: npm run db:seed:dummy
 * Повторный запуск безопасен — специалист с уже существующим email пропускается целиком,
 * файлы и сборки повторно не создаются.
 */
import {readFile} from "node:fs/promises"
import path from "node:path"
import {randomUUID} from "node:crypto"
import {PrismaClient, Role, OnboardingStatus, StepType, StepStatus, LandingBundleStatus, FileCategory} from "@prisma/client"
import {PrismaPg} from "@prisma/adapter-pg"
import {hashPassword} from "../src/lib/auth/password"
import {putObject} from "../src/lib/s3"

const adapter = new PrismaPg({connectionString: process.env.DATABASE_URL})
const prisma = new PrismaClient({adapter})

const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD ?? "Demo12345!"
const ASSETS_ROOT = path.resolve(process.cwd(), "dummy-seed", "assets")
const EMAIL_DOMAIN = "nexus-dummy.ru"
const VISUAL_COUNT = 17

type Designer = {
    slug: string
    firstName: string
    lastName: string
    city: string
    experience: number
    sqm: number
    specialty: string
    interiorStyle: string
    has3d: boolean
    hasRd: boolean
    about: string
    avatarFile: string
    videoFile?: string
}

/** Полный уровень квалификации (L1-L4 пройдены) — формат под parseQuizLevelState(). */
function eliteTestStepComment(): string {
    return JSON.stringify({
        version: 5,
        phase: "awaiting_admin",
        currentLevel: "L4",
        currentQuestionId: 0,
        questionDeadlineAt: null,
        answers: {},
        answeredCount: 0,
        liveCorrect: 0,
        total: 0,
        lastQuestionId: 0,
        attempts: [],
        passedLevels: ["L1", "L2", "L3", "L4"],
        pendingApprovalLevel: null,
        questionOrder: [],
        optionOrder: {},
    })
}

/** Четыре различных визуала на дизайнера (обложка + 3 в портфолио/галерее), с перекрытием между дизайнерами — картинок 17, дизайнеров 11. */
function pickVisuals(index: number): string[] {
    const start = (index * 4) % VISUAL_COUNT
    return [0, 1, 2, 3].map((offset) => {
        const n = ((start + offset) % VISUAL_COUNT) + 1
        return `visual-${String(n).padStart(2, "0")}.jpg`
    })
}

function projectName(specialty: string): string {
    const head = specialty.split(/[:;]/)[0].trim()
    return `Портфолио — ${head}`
}

async function uploadFile(userId: string, category: FileCategory, absPath: string, mimeType: string): Promise<string> {
    const buffer = await readFile(absPath)
    const filename = path.basename(absPath)
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_")
    const s3Key = `users/${userId}/${category.toLowerCase()}/${randomUUID()}/${safeName}`
    await putObject(s3Key, buffer, mimeType)
    const file = await prisma.userFile.create({
        data: {userId, category, s3Key, filename, mimeType, size: buffer.byteLength},
    })
    return file.id
}

async function getOrCreateAdmin(): Promise<string> {
    const existing = await prisma.user.findFirst({where: {role: Role.ADMIN}, select: {id: true}})
    if (existing) return existing.id
    const password = await hashPassword(DEMO_PASSWORD)
    const admin = await prisma.user.create({
        data: {email: "admin@example.com", role: Role.ADMIN, password},
    })
    return admin.id
}

async function seedDesigner(designer: Designer, index: number, adminId: string): Promise<void> {
    const email = `${designer.slug.replace(/-/g, ".")}@${EMAIL_DOMAIN}`
    const already = await prisma.user.findUnique({where: {email}, select: {id: true}})
    if (already) {
        console.log(`— пропущен (уже есть): ${email}`)
        return
    }

    const password = await hashPassword(DEMO_PASSWORD)
    const user = await prisma.user.create({
        data: {
            email,
            firstName: designer.firstName,
            lastName: designer.lastName,
            role: Role.SPECIALIST,
            password,
            specialistProfile: {
                create: {
                    onboardingStatus: OnboardingStatus.ACTIVE,
                    rating: 5,
                    bio: designer.about,
                    featuredOnLanding: true,
                    landingWorkPos: "center center",
                    formData: {
                        firstName: designer.firstName,
                        lastName: designer.lastName,
                        city: designer.city,
                        experience: String(designer.experience),
                        sqm: String(designer.sqm),
                        interiorStyle: designer.interiorStyle,
                        specialty: designer.specialty,
                        has3d: String(designer.has3d),
                        hasRd: String(designer.hasRd),
                        about: designer.about,
                    },
                    steps: {
                        create: {type: StepType.TEST, status: StepStatus.PASSED, comment: eliteTestStepComment()},
                    },
                },
            },
        },
        include: {specialistProfile: true},
    })

    // AVATAR-файл ищется на чтении по userId+category (см. /api/landing/specialists) — id не нужен.
    await uploadFile(user.id, "AVATAR", path.join(ASSETS_ROOT, "avatars", designer.avatarFile), "image/jpeg")

    const [workVisual, ...galleryVisuals] = pickVisuals(index)
    const workFileId = await uploadFile(
        user.id, "PORTFOLIO", path.join(ASSETS_ROOT, "visuals", workVisual), "image/jpeg",
    )
    const galleryFileIds = await Promise.all(
        galleryVisuals.map((v) => uploadFile(user.id, "PORTFOLIO", path.join(ASSETS_ROOT, "visuals", v), "image/jpeg")),
    )

    let videoFileId: string | null = null
    if (designer.videoFile) {
        videoFileId = await uploadFile(
            user.id, "INTRO_VIDEO", path.join(ASSETS_ROOT, "videos", designer.videoFile), "video/mp4",
        )
    }

    // Портфолио-проект: обложка + галерейные работы, все в одной папке.
    const allCardFileIds = [workFileId, ...galleryFileIds]
    await prisma.portfolioProject.create({
        data: {
            userId: user.id,
            name: projectName(designer.specialty),
            cards: {
                create: allCardFileIds.map((fileId, i) => ({
                    title: `${designer.lastName} — работа ${i + 1}`,
                    mainFileId: fileId,
                })),
            },
        },
    })

    // Одобренная сборка лендинга — сразу видна на главной (см. /api/landing/specialists).
    await prisma.landingBundle.create({
        data: {
            userId: user.id,
            status: LandingBundleStatus.APPROVED,
            workFileId,
            workPos: "center center",
            videoFileId,
            specialty: designer.specialty,
            about: designer.about,
            reviewedBy: adminId,
            reviewedAt: new Date(),
            items: {
                create: galleryFileIds.map((fileId, i) => ({fileId, position: i})),
            },
        },
    })

    console.log(`✓ ${email} — аватар, ${allCardFileIds.length} работы в портфолио, лендинг одобрен${videoFileId ? ", с видео" : ""}`)
}

async function main() {
    const raw = await readFile(path.join(process.cwd(), "dummy-seed", "designers.json"), "utf-8")
    const designers = JSON.parse(raw) as Designer[]

    const adminId = await getOrCreateAdmin()

    for (let i = 0; i < designers.length; i++) {
        await seedDesigner(designers[i], i, adminId)
    }

    console.log(`\nГотово. Пароль для всех: ${DEMO_PASSWORD} (переопределяется DEMO_SEED_PASSWORD)`)
}

main()
    .catch((err) => {
        console.error(err)
        process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
