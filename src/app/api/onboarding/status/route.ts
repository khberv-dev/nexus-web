import {NextRequest, NextResponse} from "next/server";
import {getServerSessionWithDevBypass} from "@/lib/session";
import {prisma} from "@/lib/db/prisma";

export async function GET(_req: NextRequest) {
    const session = await getServerSessionWithDevBypass();
    if (!session?.user) return NextResponse.json({error: "Unauthorized"}, {status: 401});

    const {zitadelSub, id} = session.user as { zitadelSub?: string | null; id: string };
    const user = await prisma.user.findUnique({
        where: zitadelSub ? {zitadelId: zitadelSub} : {id},
        include: {specialistProfile: {include: {steps: true}}},
    });
    return NextResponse.json(user?.specialistProfile ?? null);
}
