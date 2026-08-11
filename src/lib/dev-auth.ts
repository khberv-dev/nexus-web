import {prisma} from "@/lib/db/prisma"
import {OnboardingStatus, Role} from "@prisma/client"
import {isDevAuthBypass} from "@/lib/dev-auth-flag"

export {isDevAuthBypass} from "@/lib/dev-auth-flag"

/**
 * Локальная проверка UI без логина.
 *
 * В `.env.local` (только dev, никогда в prod):
 *   DEV_AUTH_BYPASS=true
 *   DEV_MOCK_ROLE=CLIENT        # или SPECIALIST | ADMIN
 *   DEV_MOCK_USER_ID=clxxx…     # опционально: точный id из таблицы User
 *
 * Берется пользователь из БД: сначала по DEV_MOCK_USER_ID, иначе первый с ролью DEV_MOCK_ROLE.
 * Если таблица User пуста — создается один тестовый пользователь (email dev-bypass-{role}@local.invalid).
 * Роль по умолчанию CLIENT (как в middleware); для /work задайте DEV_MOCK_ROLE=SPECIALIST, для админки — ADMIN.
 */

export async function resolveDevMockDbUser() {
    if (!isDevAuthBypass()) return null

    const id = process.env.DEV_MOCK_USER_ID?.trim()
    if (id) {
        const byId = await prisma.user.findUnique({where: {id}})
        if (byId) return byId
    }

    const r =
        process.env.DEV_MOCK_ROLE?.trim().toUpperCase() ??
        process.env.NEXT_PUBLIC_DEV_MOCK_ROLE?.trim().toUpperCase()
    const roleFromEnv: Role | undefined =
        r === "ADMIN" || r === "SPECIALIST" || r === "CLIENT" ? (r as Role) : undefined

    if (roleFromEnv) {
        const byRole = await prisma.user.findFirst({
            where: {role: roleFromEnv},
            orderBy: {createdAt: "asc"},
        })
        if (byRole) return byRole
    } else {
        const anyUser = await prisma.user.findFirst({orderBy: {createdAt: "asc"}})
        if (anyUser) return anyUser
    }

    const bootRole: Role = roleFromEnv ?? Role.CLIENT
    const email = `dev-bypass-${bootRole.toLowerCase()}@local.invalid`

    try {
        const user = await prisma.$transaction(async (tx) => {
            const u = await tx.user.upsert({
                where: {email},
                create: {
                    email,
                    name: "Dev bypass",
                    role: bootRole,
                    zitadelId: null,
                },
                update: {},
            })

            if (u.role === Role.SPECIALIST) {
                await tx.specialistProfile.upsert({
                    where: {userId: u.id},
                    create: {userId: u.id, onboardingStatus: OnboardingStatus.ACTIVE},
                    update: {onboardingStatus: OnboardingStatus.ACTIVE},
                })
            } else if (u.role === Role.CLIENT) {
                await tx.clientProfile.upsert({
                    where: {userId: u.id},
                    create: {userId: u.id},
                    update: {},
                })
            }

            return u
        })

        console.warn(`[dev-auth] В БД не было User — создан тестовый ${email} (${bootRole})`)
        return user
    } catch (e) {
        console.error("[dev-auth] Не удалось создать dev User:", e)
        return null
    }
}
