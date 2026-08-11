import {NextRequest, NextResponse} from "next/server";
import {prisma} from "@/lib/db/prisma";
import {getDownloadUrl} from "@/lib/s3";
import {devOnlyGuard} from "@/lib/dev-only";

export async function GET(req: NextRequest) {
    // Dev-only login helper: leaks user email/name/phone. Never expose in prod.
    const blocked = devOnlyGuard();
    if (blocked) return blocked;

    const role = req.nextUrl.searchParams.get("role");
    if (!role) return NextResponse.json([]);

    const users = await prisma.user.findMany({
        where: {role: role as "CLIENT" | "SPECIALIST" | "ADMIN"},
        select: {
            id: true,
            email: true,
            name: true,
            zitadelId: true,
            role: true,
            specialistProfile: {
                select: {
                    formData: true,
                    steps: {select: {type: true, status: true}},
                },
            },
            clientProfile: {
                select: {formData: true},
            },
            files: {
                where: {category: "AVATAR"},
                orderBy: {createdAt: "desc"},
                take: 1,
                select: {id: true},
            },
        },
        orderBy: {createdAt: "desc"},
        take: 20,
    });

    const mapped = await Promise.all(
        users.map(async u => {
            const fd = (u.specialistProfile?.formData ?? u.clientProfile?.formData ?? null) as Record<string, string> | null
            let href = "/onboarding"
            if (u.role === "SPECIALIST" && u.specialistProfile) {
                const passed = new Set(
                    u.specialistProfile.steps.filter(s => s.status === "PASSED").map(s => s.type)
                )
                const allDone =
                    !!u.specialistProfile.formData &&
                    passed.has("TEST") &&
                    passed.has("INTERVIEW") &&
                    passed.has("REGULATIONS") &&
                    passed.has("CONTRACT")
                if (allDone) href = "/work"
            }
            if (u.role === "CLIENT") {
                href = u.clientProfile?.formData ? "/orders" : "/orders/onboarding"
            }
            if (u.role === "ADMIN") href = "/admin"

            let avatarUrl: string | null = null
            if (u.files[0]) {
                const file = await prisma.userFile.findUnique({where: {id: u.files[0].id}, select: {s3Key: true}})
                if (file) try {
                    avatarUrl = (await getDownloadUrl(file.s3Key)).url
                } catch {
                }
            }

            return {
                id: u.id,
                email: u.email,
                name: fd?.fullName ?? u.name ?? null,
                zitadelId: u.zitadelId,
                role: u.role,
                href,
                avatarUrl
            }
        })
    )

    return NextResponse.json(mapped)
}
