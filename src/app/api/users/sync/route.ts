import {NextRequest, NextResponse} from "next/server";
import {getServerSessionWithDevBypass} from "@/lib/session";
import {prisma} from "@/lib/db/prisma";
import {Role} from "@prisma/client";

export async function POST(_req: NextRequest) {
    const session = await getServerSessionWithDevBypass();
    if (!session?.user?.email) return NextResponse.json({error: "Unauthorized"}, {status: 401});

    const zitadelSub = session.user.zitadelSub;
    const {email, role, phone, id} = session.user;

    if (zitadelSub) {
        const user = await prisma.user.upsert({
            where: {zitadelId: zitadelSub},
            update: {email, role: role as Role, phone: phone ?? undefined},
            create: {
                zitadelId: zitadelSub,
                email,
                role: role as Role,
                phone: phone ?? undefined,
                ...(role === "SPECIALIST"
                    ? {specialistProfile: {create: {onboardingStatus: "PENDING"}}}
                    : {}),
            },
        });
        return NextResponse.json({id: user.id});
    }

    if (!id) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    return NextResponse.json({id});
}
