import { prisma } from "@/lib/db/prisma"
import { isDevAuthBypass } from "@/lib/dev-auth-flag"
import { OnboardingStatus, OrderStatus, Role } from "@prisma/client"

const DEMO_CLIENT_EMAIL = "dev-demo-client@local.invalid"
const DEMO_SPECIALIST_EMAIL = "dev-demo-specialist@local.invalid"

/**
 * Если включен DEV_AUTH_BYPASS и в БД нет заказов — создаем демо-заказ (BRIEF_REVIEW, без специалиста)
 * и двух пользователей, чтобы в админке можно было назначить специалиста.
 */
export async function ensureDevBypassDemoOrders(): Promise<void> {
  if (!isDevAuthBypass()) return
  if ((await prisma.order.count()) > 0) return

  const client = await prisma.user.upsert({
    where: { email: DEMO_CLIENT_EMAIL },
    create: {
      email: DEMO_CLIENT_EMAIL,
      name: "Demo client",
      role: Role.CLIENT,
      zitadelId: null,
    },
    update: {},
  })

  await prisma.clientProfile.upsert({
    where: { userId: client.id },
    create: { userId: client.id, formData: {} },
    update: {},
  })

  const specialist = await prisma.user.upsert({
    where: { email: DEMO_SPECIALIST_EMAIL },
    create: {
      email: DEMO_SPECIALIST_EMAIL,
      name: "Demo specialist",
      role: Role.SPECIALIST,
      zitadelId: null,
    },
    update: {},
  })

  await prisma.specialistProfile.upsert({
    where: { userId: specialist.id },
    create: { userId: specialist.id, onboardingStatus: OnboardingStatus.ACTIVE },
    update: { onboardingStatus: OnboardingStatus.ACTIVE },
  })

  await prisma.order.create({
    data: {
      clientId: client.id,
      status: OrderStatus.BRIEF_REVIEW,
      title: "Демо: назначьте специалиста",
      briefData: {
        name: "Демонстрационный заказ",
        style: "Современный",
        objectType: "Квартира",
      },
    },
  })

  console.warn(
    "[dev-demo] Созданы демо-заказ (BRIEF_REVIEW), клиент и специалист для проверки назначения",
  )
}
