import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"
import { prisma } from "@/lib/db/prisma"
import { transition } from "@/lib/stage-machine"
import { sendEmail } from "@/lib/email"
import { audit } from "@/lib/audit"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const { action, comment }: { action: "accept" | "reject"; comment?: string } = await req.json().catch(() => ({}))
  if (action !== "accept" && action !== "reject") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  const stage = await prisma.projectStage.findUnique({
    where: { id },
    include: { order: { include: { client: true, specialist: true } } },
  })
  if (!stage) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // We only handle client feedback when it has moved the stage into CLIENT_REVISION.
  if (stage.status !== "CLIENT_REVISION") {
    return NextResponse.json({ error: "Stage is not in CLIENT_REVISION" }, { status: 409 })
  }

  if (action === "accept") {
    // No state change: this is an admin acknowledgement. Optionally re-notify specialist with comment.
    try {
      await audit(user.id, "client_revision_accepted", "ProjectStage", id, {
        stageStatus: { to: stage.status },
        ...(comment?.trim() ? { comment: { to: comment.trim() } } : {}),
      })
    } catch {
      // audit must not break the flow
    }
    if (stage.order.specialist?.email) {
      void sendEmail("stage_revision", stage.order.specialist.email, {
        stageId: id,
        orderId: stage.orderId,
        comment: comment?.trim() ? `Администратор принял правки клиента: ${comment.trim()}` : "Администратор принял правки клиента.",
      })
    }
    return NextResponse.json({ ok: true })
  }

  // reject: return stage back to CLIENT_REVIEW (undo client revision request)
  try {
    const newStatus = await transition(id, "resubmitClient", "ADMIN", comment, user.id)
    // notify client that revision was rejected (reuse generic trigger with comment)
    if (stage.order.client?.email) {
      void sendEmail("stage_mod_approved", stage.order.client.email, {
        stageId: id,
        orderId: stage.orderId,
        comment: comment?.trim() ? `Администратор отклонил правки: ${comment.trim()}` : "Администратор отклонил правки.",
      })
    }
    return NextResponse.json({ status: newStatus })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 409 })
  }
}

