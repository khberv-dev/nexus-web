import {NextRequest, NextResponse} from "next/server";
import {getServerSessionWithDevBypass, getSessionDbUser, getSessionUser} from "@/lib/session";
import {prisma} from "@/lib/db/prisma";
import {notifySpecialistStep} from "@/lib/onboarding/notify-step";
import {audit} from "@/lib/audit";

const ONBOARDING_LABELS: Record<string, string> = {
    TEST_INVITED: "Приглашение на квалификационный тест",
    INTERVIEW_INVITED: "Приглашение на интервью",
    REGULATIONS: "Изучение регламентов",
    CONTRACT: "Подписание договора",
    ACTIVE: "Добро пожаловать на платформу!",
    REJECTED: "Заявка отклонена",
};

export async function PATCH(req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const session = await getServerSessionWithDevBypass();
    if (!session?.user) return NextResponse.json({error: "Unauthorized"}, {status: 401});

    const {role} = session.user as { role: string };
    if (role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403});

    const {id} = await params;
    const {onboardingStatus, comment} = await req.json() as { onboardingStatus: string; comment?: string };

    // Админ может поставить любой статус, даже если дизайнер не закрыл предыдущие шаги:
    // непройденное не блокирует, а попадает в аудит как forcedSteps.
    const REQUIRED_STEPS_BEFORE: Record<string, string[]> = {
        TEST_INVITED: ["FORM"],
        INTERVIEW_INVITED: ["FORM", "TEST"],
        REGULATIONS: ["FORM", "TEST", "INTERVIEW"],
        CONTRACT: ["FORM", "TEST", "INTERVIEW", "REGULATIONS_READ", "REGULATIONS"],
        ACTIVE: ["FORM", "TEST", "INTERVIEW", "REGULATIONS_READ", "REGULATIONS", "CONTRACT"],
    };
    const requiredBefore = REQUIRED_STEPS_BEFORE[onboardingStatus] ?? [];
    let forcedSteps: string[] = [];
    if (requiredBefore.length > 0) {
        const existing = await prisma.specialistProfile.findUnique({where: {id}, include: {steps: true}});
        if (!existing) return NextResponse.json({error: "Not found"}, {status: 404});
        const passedTypes = new Set(existing.steps.filter(s => s.status === "PASSED").map(s => s.type));
        const has = (t: string) => {
            if (t === "REGULATIONS_READ") return passedTypes.has("REGULATIONS_READ" as never) || passedTypes.has("REGULATIONS" as never)
            return passedTypes.has(t as never)
        }
        forcedSteps = requiredBefore.filter(t => !has(t));
    }

    const profile = await prisma.specialistProfile.update({
        where: {id},
        data: {onboardingStatus: onboardingStatus as never},
        include: {user: true},
    });

    const ONBOARDING_URLS: Record<string, string> = {
        TEST_INVITED: "/onboarding/test",
        INTERVIEW_INVITED: "/onboarding/interview",
        REGULATIONS: "/onboarding/regulations",
        CONTRACT: "/onboarding/contract",
        ACTIVE: "/work",
    };
    const title = ONBOARDING_LABELS[onboardingStatus] ?? `Статус: ${onboardingStatus}`;
    await notifySpecialistStep({
        userId: profile.userId,
        email: profile.user.email,
        status: onboardingStatus,
        title,
        message: comment?.trim() || title,
        url: ONBOARDING_URLS[onboardingStatus] ?? "/onboarding",
    });

    // Принудительное продвижение фиксируем в истории — иначе непройденные шаги
    // выглядят как обычная сдача.
    if (forcedSteps.length > 0) {
        const sessionUser = await getSessionUser();
        const dbAdmin = sessionUser ? await getSessionDbUser(sessionUser) : null;
        await audit(dbAdmin?.id ?? null, "specialist_advanced", "User", profile.userId, {
            onboardingStatus: {to: onboardingStatus},
            forcedSteps: {to: forcedSteps.join(", ")},
        });
    }

    return NextResponse.json({...profile, forcedSteps});
}
