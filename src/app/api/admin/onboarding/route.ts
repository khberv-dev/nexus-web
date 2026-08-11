import {NextRequest, NextResponse} from "next/server";
import {getServerSessionWithDevBypass} from "@/lib/session";
import {prisma} from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
    const session = await getServerSessionWithDevBypass();
    if (!session?.user) return NextResponse.json({error: "Unauthorized"}, {status: 401});

    const {role} = session.user as { role: string };
    if (role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403});

    const status = req.nextUrl.searchParams.get("status");
    const profiles = await prisma.specialistProfile.findMany({
        where: status ? {onboardingStatus: status as never} : {},
        include: {user: {select: {email: true}}, steps: true},
        orderBy: {createdAt: "desc"},
    });
    return NextResponse.json(profiles);
}
