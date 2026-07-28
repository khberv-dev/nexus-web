import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getDownloadUrl } from "@/lib/s3"

export const dynamic = "force-dynamic"

async function fileUrl(fileId: string | null): Promise<string | null> {
  if (!fileId) return null
  const file = await prisma.userFile.findUnique({ where: { id: fileId }, select: { s3Key: true } })
  if (!file) return null
  const { url } = await getDownloadUrl(file.s3Key)
  return url
}

export async function GET() {
  const bundles = await prisma.landingBundle.findMany({
    where: { status: "APPROVED" },
    include: {
      user: {
        select: {
          name: true,
          specialistProfile: { select: { rating: true, formData: true, landingWorkPos: true } },
        },
      },
      items: { orderBy: { position: "asc" } },
    },
    orderBy: { reviewedAt: "desc" },
  })

  const slides = await Promise.all(
    bundles
      .filter(b => b.portraitFileId && b.workFileId)
      .map(async (b) => {
        const fd = (b.user.specialistProfile?.formData as Record<string, string> | null) ?? {}
        const [portrait, work, introVideoUrl, ...portfolioUrls] = await Promise.all([
          fileUrl(b.portraitFileId),
          fileUrl(b.workFileId),
          fileUrl(b.videoFileId),
          ...b.items.map(item => fileUrl(item.fileId)),
        ])

        return {
          portrait,
          work,
          workPos: b.workPos ?? b.user.specialistProfile?.landingWorkPos ?? "center center",
          name: b.user.name ?? fd.fullName ?? "Специалист",
          specialty: b.specialty ?? fd.specialty ?? fd.specialization ?? "",
          sqm: parseInt(fd.sqm ?? "0") || 0,
          experience: parseInt(fd.experience ?? "0") || 0,
          style: fd.interiorStyle ?? fd.specialty ?? fd.specialization ?? "",
          has3d: fd.has3d === "true",
          hasRd: fd.hasRd === "true",
          bio: b.about ?? fd.about ?? "",
          portfolioImages: portfolioUrls.filter(Boolean),
          introVideoUrl,
        }
      }),
  )

  return NextResponse.json(slides)
}
