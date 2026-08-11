import {NextRequest, NextResponse} from "next/server";
import {getServerSessionWithDevBypass} from "@/lib/session";
import {prisma} from "@/lib/db/prisma";
import {zitadelClient} from "@/lib/zitadel/client";

export async function POST(_req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const session = await getServerSessionWithDevBypass();
    if (!session?.user) return NextResponse.json({error: "Unauthorized"}, {status: 401});

    const {role} = session.user as { role: string };
    if (role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403});

    const {id} = await params;
    const profile = await prisma.specialistProfile.findUnique({where: {id}, include: {user: true}});
    if (!profile) return NextResponse.json({error: "Not found"}, {status: 404});
    if (!profile.user.email) return NextResponse.json({error: "У пользователя нет email"}, {status: 400});

    const {userId} = await zitadelClient.createUser(profile.user.email);
    await zitadelClient.assignRole(userId, "SPECIALIST");

    return NextResponse.json({ok: true, zitadelUserId: userId});
}
