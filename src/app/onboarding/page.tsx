import Link from "next/link"
import {redirect} from "next/navigation"
import {OnboardingShell} from "@/components/app/OnboardingShell"
import {AppCard, StatusBadge} from "@/components/app/AppCard"
import {OnboardingStatusPoller} from "@/components/app/OnboardingStatusPoller"
import {prisma} from "@/lib/db/prisma"
import {parseQuizLevelState} from "@/lib/onboarding/levels/state"
import {getSessionUser} from "@/lib/session"

const STEPS = [
    {
        key: "FORM",
        label: "Анкета",
        desc: "Заполните информацию о себе и опыте работы",
        href: "/onboarding/form",
        action: "Заполнить анкету →"
    },
    {
        key: "TEST",
        label: "Квалификационный тест",
        desc: "Открывается после приглашения администратора",
        href: "/onboarding/test",
        action: "Пройти тест →"
    },
    {
        key: "INTERVIEW",
        label: "Интервью",
        desc: "Zoom-интервью с командой платформы",
        href: "/onboarding/interview",
        action: "Перейти к интервью →"
    },
    {
        key: "REGULATIONS_READ",
        label: "Регламент",
        desc: "Ознакомьтесь с правилами работы на платформе",
        href: "/onboarding/regulations/read",
        action: "Ознакомиться →"
    },
    {
        key: "REGULATIONS",
        label: "Тест по регламенту",
        desc: "Проверьте знание правил платформы",
        href: "/onboarding/regulations",
        action: "Пройти тест →"
    },
    {
        key: "CONTRACT",
        label: "Договор",
        desc: "Подписание договора с платформой",
        href: "/onboarding/contract",
        action: "Подписать договор →"
    },
]

export default async function OnboardingPage() {
    const sessionUser = await getSessionUser()
    if (!sessionUser) redirect("/login")
    if (sessionUser.role !== "SPECIALIST") redirect("/orders")

    // Determine current step from DB
    const dbUser = await prisma.user.findUnique({
        where: {id: sessionUser.id},
        include: {specialistProfile: {include: {steps: true}}},
    })
    const passedSteps = new Set(
        dbUser?.specialistProfile?.steps
            .filter(s => s.status === "PASSED")
            .map(s => s.type) ?? []
    )

    const STEP_KEYS = ["FORM", "TEST", "INTERVIEW", "REGULATIONS_READ", "REGULATIONS", "CONTRACT"] as const
    const isDoneByIndex = (i: number) => {
        const key = STEP_KEYS[i]
        // Backward-compat: if REGULATIONS quiz is PASSED, consider REGULATIONS_READ completed as well.
        if (key === "REGULATIONS_READ") return passedSteps.has("REGULATIONS" as never) || passedSteps.has("REGULATIONS_READ" as never)
        return passedSteps.has(key as never)
    }
    let currentStep = 0
    for (let i = 0; i < STEP_KEYS.length; i++) {
        if (isDoneByIndex(i)) currentStep = i + 1
        else break
    }
    currentStep = Math.min(currentStep, STEP_KEYS.length - 1)

    const isActive = dbUser?.specialistProfile?.onboardingStatus === "ACTIVE"
    const onboardingStatus = dbUser?.specialistProfile?.onboardingStatus ?? "PENDING"
    const testUnlocked = ["TEST_INVITED", "INTERVIEW_INVITED", "REGULATIONS", "CONTRACT", "ACTIVE"].includes(onboardingStatus)
    const allDone = isActive || STEP_KEYS.every((_, i) => isDoneByIndex(i))
    const testStep = dbUser?.specialistProfile?.steps.find((s) => s.type === "TEST")
    const quizState = parseQuizLevelState(testStep?.comment ?? null)
    const levelLabels: Record<string, string> = {
        L1: "JUNIOR",
        L2: "SENIOR",
        L3: "MASTER",
        L4: "ELITE",
    }
    const highestPassedLevel = (quizState?.passedLevels ?? []).sort().at(-1) ?? null

    return (
        <OnboardingShell title="Онбординг" withBg>
            {onboardingStatus === "REGULATIONS" && <OnboardingStatusPoller currentStatus={onboardingStatus}/>}
            <div className="mx-auto max-w-2xl px-6 py-12">
                <div className="mb-10">
                    <h1 style={{color: "#f4f4f4", fontSize: "clamp(1.5rem,3vw,2rem)", fontWeight: 500, margin: 0}}>
                        Верификация специалиста
                    </h1>
                    <p style={{color: "rgba(255,255,255,0.45)", marginTop: "0.5em", fontSize: "0.95rem"}}>
                        Пройдите все этапы для начала работы на платформе
                    </p>
                    {highestPassedLevel && (
                        <p style={{color: "rgba(255,255,255,0.65)", marginTop: "0.35em", fontSize: "0.85rem"}}>
                            Подтвержденный уровень: {levelLabels[highestPassedLevel] ?? highestPassedLevel}
                        </p>
                    )}
                </div>

                <div className="flex flex-col gap-3">
                    {STEPS.map((step, i) => {
                        const isDone = isDoneByIndex(i)
                        const isCurrent = !allDone && i === currentStep
                        const isPending = !allDone && i > currentStep

                        return (
                            <AppCard key={step.key}
                                     style={{opacity: isPending ? 0.45 : 1, cursor: isPending ? "default" : "auto"}}>
                                <div className="flex items-start gap-4">
                                    <div
                                        className="flex items-center justify-center rounded-full shrink-0 font-semibold"
                                        style={{
                                            width: 36, height: 36, fontSize: "0.85rem",
                                            background: isDone ? "rgba(52,211,153,0.15)" : isCurrent ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)",
                                            color: isDone ? "#34d399" : isCurrent ? "#f4f4f4" : "rgba(255,255,255,0.25)",
                                            border: isDone ? "1px solid rgba(52,211,153,0.3)" : isCurrent ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(255,255,255,0.08)",
                                        }}
                                    >
                                        {isDone ? "✓" : i + 1}
                                    </div>

                                    <div className="flex-1">
                                        <div className="flex items-center justify-between gap-3">
                                            <span style={{
                                                color: "#f4f4f4",
                                                fontSize: "0.95rem",
                                                fontWeight: 500
                                            }}>{step.label}</span>
                                            <StatusBadge
                                                variant={isDone ? "done" : isCurrent ? "current" : "pending"}
                                                label={isDone ? "Готово" : isCurrent ? "Текущий" : "Ожидает"}
                                            />
                                        </div>
                                        <p style={{
                                            color: "rgba(255,255,255,0.4)",
                                            fontSize: "0.82rem",
                                            marginTop: "0.35em"
                                        }}>{step.desc}</p>

                                        {isCurrent && step.href && (step.key !== "TEST" || testUnlocked) && (
                                            <a
                                                href={step.href}
                                                style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: 6,
                                                    marginTop: "0.75em",
                                                    background: "rgba(255,255,255,0.07)",
                                                    border: "1px solid rgba(255,255,255,0.18)",
                                                    borderRadius: 8,
                                                    color: "#f4f4f4",
                                                    fontSize: "0.82rem",
                                                    fontWeight: 500,
                                                    padding: "0.45em 1em",
                                                    textDecoration: "none",
                                                }}
                                            >
                                                {step.action}
                                            </a>
                                        )}

                                        {isCurrent && (step.key === "TEST" && !testUnlocked) && (
                                            <p style={{
                                                color: "rgba(255,255,255,0.3)",
                                                fontSize: "0.8rem",
                                                marginTop: "0.5em",
                                                fontStyle: "italic"
                                            }}>
                                                Ожидайте подтверждения анкеты администратором. После этого откроется
                                                доступ к тесту.
                                            </p>
                                        )}

                                        {isCurrent && !step.href && step.key !== "TEST" && (
                                            <p style={{
                                                color: "rgba(255,255,255,0.3)",
                                                fontSize: "0.8rem",
                                                marginTop: "0.5em",
                                                fontStyle: "italic"
                                            }}>
                                                Ожидайте приглашения от администратора
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </AppCard>
                        )
                    })}
                </div>

                {allDone && (
                    <div style={{marginTop: "2rem", display: "flex", flexDirection: "column", gap: 12}}>
                        <AppCard
                            style={{background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.2)"}}>
                            <div style={{display: "flex", alignItems: "center", gap: 12}}>
                                <div style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: "50%",
                                    background: "rgba(52,211,153,0.15)",
                                    border: "1px solid rgba(52,211,153,0.3)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "1rem",
                                    flexShrink: 0
                                }}>✓
                                </div>
                                <div>
                                    <div style={{color: "#34d399", fontWeight: 500, fontSize: "0.95rem"}}>Верификация
                                        пройдена
                                    </div>
                                    <div style={{color: "rgba(255,255,255,0.4)", fontSize: "0.82rem", marginTop: 2}}>Все
                                        этапы успешно завершены. Вы можете приступать к работе.
                                    </div>
                                </div>
                            </div>
                        </AppCard>
                        <Link
                            href="/work"
                            style={{
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                padding: "0.9em 1.5em",
                                background: "rgba(255,255,255,0.08)",
                                border: "1px solid rgba(255,255,255,0.2)",
                                borderRadius: 10,
                                color: "#f4f4f4",
                                fontSize: "0.9rem",
                                fontWeight: 500,
                                textDecoration: "none",
                            }}
                        >
                            Перейти в личный кабинет →
                        </Link>
                    </div>
                )}
            </div>
        </OnboardingShell>
    )
}
