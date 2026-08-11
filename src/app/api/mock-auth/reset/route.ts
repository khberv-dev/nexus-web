import {NextRequest, NextResponse} from "next/server";
import {prisma} from "@/lib/db/prisma";
import {devOnlyGuard} from "@/lib/dev-only";

// Сбрасывает онбординг специалиста — вызывается при создании нового mock-пользователя.
// Dev-only: unauthenticated and destructive (wipes onboarding by email). Never in prod.
export async function POST(req: NextRequest) {
    const blocked = devOnlyGuard();
    if (blocked) return blocked;

    const {email} = await req.json();

    const user = await prisma.user.findUnique({where: {email}});
    if (user) {
        const profile = await prisma.specialistProfile.findUnique({where: {userId: user.id}});
        if (profile) {
            await prisma.onboardingStep.deleteMany({where: {profileId: profile.id}});
            await prisma.specialistProfile.delete({where: {id: profile.id}});
        }
    }

    return NextResponse.json({ok: true});
}
