import { NextRequest, NextResponse } from "next/server";
import { getServerSessionWithDevBypass } from "@/lib/session";
import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email";
import { notify } from "@/lib/notifications";

const ONBOARDING_LABELS: Record<string, string> = {
  TEST_INVITED: "Приглашение на квалификационный тест",
  INTERVIEW_INVITED: "Приглашение на интервью",
  REGULATIONS: "Изучение регламентов",
  CONTRACT: "Подписание договора",
  ACTIVE: "Добро пожаловать на платформу!",
  REJECTED: "Заявка отклонена",
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSessionWithDevBypass();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { role } = session.user as { role: string };
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { onboardingStatus, comment } = await req.json() as { onboardingStatus: string; comment?: string };

  // Guard: ACTIVE only when all 5 onboarding steps are PASSED
  if (onboardingStatus === "ACTIVE") {
    const existing = await prisma.specialistProfile.findUnique({ where: { id }, include: { steps: true } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const passedTypes = new Set(existing.steps.filter(s => s.status === "PASSED").map(s => s.type));
    const has = (t: string) => {
      if (t === "REGULATIONS_READ") return passedTypes.has("REGULATIONS_READ" as never) || passedTypes.has("REGULATIONS" as never)
      return passedTypes.has(t as never)
    }
    const allPassed = ["FORM", "TEST", "INTERVIEW", "REGULATIONS_READ", "REGULATIONS", "CONTRACT"].every(has);
    if (!allPassed) {
      return NextResponse.json({ error: "Нельзя активировать: не все шаги онбординга пройдены" }, { status: 409 });
    }
  }

  // Guard: sequential onboarding — cannot skip steps
  const REQUIRED_STEPS_BEFORE: Record<string, string[]> = {
    TEST_INVITED: ["FORM"],
    INTERVIEW_INVITED: ["FORM", "TEST"],
    REGULATIONS: ["FORM", "TEST", "INTERVIEW"],
    CONTRACT: ["FORM", "TEST", "INTERVIEW", "REGULATIONS_READ", "REGULATIONS"],
    ACTIVE: ["FORM", "TEST", "INTERVIEW", "REGULATIONS_READ", "REGULATIONS", "CONTRACT"],
  };
  const requiredBefore = REQUIRED_STEPS_BEFORE[onboardingStatus];
  if (requiredBefore && onboardingStatus !== "ACTIVE") {
    const existing = await prisma.specialistProfile.findUnique({ where: { id }, include: { steps: true } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const passedTypes = new Set(existing.steps.filter(s => s.status === "PASSED").map(s => s.type));
    const missing = requiredBefore.filter(t => !passedTypes.has(t as never));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Нельзя перейти к ${onboardingStatus}: не пройдены шаги ${missing.join(", ")}` },
        { status: 409 },
      );
    }
  }

  const profile = await prisma.specialistProfile.update({
    where: { id },
    data: { onboardingStatus: onboardingStatus as never },
    include: { user: true },
  });

  if (profile.user.email) {
    void sendEmail("onboarding_status", profile.user.email, { status: onboardingStatus, comment });
  }

  const title = ONBOARDING_LABELS[onboardingStatus] ?? `Статус: ${onboardingStatus}`;
  void notify(profile.userId, "onboarding_status", title, comment ?? undefined, "/onboarding");

  return NextResponse.json(profile);
}
