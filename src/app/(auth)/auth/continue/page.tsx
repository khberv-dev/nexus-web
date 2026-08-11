import {redirect} from "next/navigation";
import {getServerSessionWithDevBypass} from "@/lib/session";
import {prisma} from "@/lib/db/prisma";
import {OnboardingStatus} from "@prisma/client";
import {isClientCabinetProfileComplete} from "@/lib/client-requisites-validation";

/** После входа по magic link / OAuth — маршрут по роли и заполненности профиля. */
export default async function AuthContinuePage() {
    const session = await getServerSessionWithDevBypass();
    if (!session?.user?.id) redirect("/login");

    const user = await prisma.user.findUnique({
        where: {id: session.user.id},
        include: {specialistProfile: true, clientProfile: true},
    });
    if (!user) redirect("/login");

    if (user.role === "ADMIN") redirect("/admin");

    if (user.role === "SPECIALIST") {
        if (user.specialistProfile?.onboardingStatus === OnboardingStatus.ACTIVE) {
            redirect("/work");
        }
        redirect("/onboarding");
    }

    if (user.role === "CLIENT") {
        if (isClientCabinetProfileComplete(user.clientProfile?.formData)) redirect("/orders");
        const pending = await prisma.requisiteChangeRequest.findFirst({
            where: {clientId: user.id, status: "PENDING"},
            select: {id: true},
        })
        if (pending) redirect("/orders")
        redirect("/orders/onboarding")
    }

    redirect("/login");
}
