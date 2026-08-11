import {OrderStatus, PaymentStatus, Role, StageStatus} from "@prisma/client";
import {prisma} from "@/lib/db/prisma";
import {releasePayment} from "@/lib/billing";
import {MAX_FREE_CLIENT_REVISIONS, STAGE_ORDER} from "@/lib/stage-constants";
import {syncStageSequentialLocks} from "@/lib/stage-sequencing";
import {notify} from "@/lib/notifications";
import {isStagePaymentsDisabled} from "@/lib/payments/flags";
import {audit} from "@/lib/audit";
import {isOrderComplete} from "@/lib/order-completion";

const STAGE_LABELS_RU = {
    CONCEPT: "Концепция",
    PLANNING: "Планировка",
    VISUALIZATION: "Визуализация",
    DOCUMENTATION: "Рабочая документация",
    SPECIFICATION: "Спецификация на материалы",
} as const;

/** Action for specialist hand-off after files are in UPLOADED (or re-upload after admin/client sent back). */
export function getSpecialistSubmitAction(
    status: StageStatus,
): "submit" | "resubmitMod" | "resubmitClient" | null {
    switch (status) {
        case StageStatus.UPLOADED:
            return "submit";
        case StageStatus.MOD_REVISION:
            return "resubmitMod";
        case StageStatus.CLIENT_REVISION:
            return "resubmitClient";
        default:
            return null;
    }
}

export class TransitionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "TransitionError";
    }
}

export class ForbiddenError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ForbiddenError";
    }
}

type StageAction =
    | "upload"
    | "submit"
    | "modApprove"
    | "modRevision"
    | "resubmitMod"
    | "clientApprove"
    | "clientRevision"
    | "resubmitClient"
    | "paymentConfirmed"
    | "stagePaymentConfirmed";

interface Transition {
    allowedRoles: Role[];
    nextStatus: StageStatus;
    incrementModRound?: boolean;
    incrementClientRound?: boolean;
}

// Base transitions (clientRound-independent)
const BASE_STAGE_TRANSITIONS: Partial<Record<StageStatus, Partial<Record<StageAction, Transition>>>> = {
    AWAITING_PAYMENT: {
        stagePaymentConfirmed: {allowedRoles: [Role.ADMIN], nextStatus: StageStatus.PENDING},
    },
    PENDING: {
        upload: {allowedRoles: [Role.SPECIALIST], nextStatus: StageStatus.UPLOADED},
    },
    UPLOADED: {
        submit: {allowedRoles: [Role.SPECIALIST], nextStatus: StageStatus.MOD_REVIEW},
    },
    MOD_REVIEW: {
        modApprove: {allowedRoles: [Role.ADMIN], nextStatus: StageStatus.CLIENT_REVIEW},
    },
    MOD_REVISION: {
        resubmitMod: {allowedRoles: [Role.SPECIALIST], nextStatus: StageStatus.MOD_REVIEW},
    },
    CLIENT_REVIEW: {
        // Client approval finalizes the stage directly (triggers StageAct + payout).
        // Client-requested revisions still route through the moderator — see the
        // CLIENT_REVIEW + clientRevision branch in getNextStatus below.
        clientApprove: {allowedRoles: [Role.CLIENT], nextStatus: StageStatus.APPROVED},
    },
    CLIENT_REVISION: {
        // After fixes, always go to moderator before client sees it.
        resubmitClient: {allowedRoles: [Role.SPECIALIST, Role.ADMIN], nextStatus: StageStatus.MOD_REVIEW},
    },
    EXTRA_PAYMENT: {
        paymentConfirmed: {allowedRoles: [Role.ADMIN], nextStatus: StageStatus.CLIENT_REVISION},
    },
};

/** Pure function — no side effects */
export function canTransition(status: StageStatus, action: StageAction, role: Role, clientRound = 0, modRound = 0): boolean {
    try {
        getNextStatus(status, action, role, clientRound, modRound);
        return true;
    } catch {
        return false;
    }
}

export function getNextStatus(status: StageStatus, action: StageAction, role: Role, clientRound = 0, modRound = 0): StageStatus {
// CLIENT_REVIEW → clientRevision: MAX_FREE_CLIENT_REVISIONS бесплатных раундов, затем EXTRA_PAYMENT
    if (status === StageStatus.CLIENT_REVIEW && action === "clientRevision") {
        if (!([Role.CLIENT] as Role[]).includes(role)) throw new ForbiddenError(`Role ${role} cannot trigger ${action}`);
        if (isStagePaymentsDisabled()) return StageStatus.MOD_REVIEW;
        return clientRound >= MAX_FREE_CLIENT_REVISIONS ? StageStatus.EXTRA_PAYMENT : StageStatus.MOD_REVIEW;
    }

    // MOD_REVIEW → modRevision: 1 free round, then EXTRA_PAYMENT
    if (status === StageStatus.MOD_REVIEW && action === "modRevision") {
        if (!([Role.ADMIN] as Role[]).includes(role)) throw new ForbiddenError(`Role ${role} cannot trigger ${action}`);
        if (isStagePaymentsDisabled()) return StageStatus.MOD_REVISION;
        return modRound >= 1 ? StageStatus.EXTRA_PAYMENT : StageStatus.MOD_REVISION;
    }

    const transitions = BASE_STAGE_TRANSITIONS[status];
    if (!transitions) throw new TransitionError(`No transitions from ${status}`);
    const t = transitions[action];
    if (!t) throw new TransitionError(`Action ${action} not allowed from ${status}`);
    if (!t.allowedRoles.includes(role)) throw new ForbiddenError(`Role ${role} cannot trigger ${action}`);
    return t.nextStatus;
}

export function getAllowedActions(status: StageStatus, role: Role, clientRound = 0, modRound = 0): StageAction[] {
    const actions: StageAction[] = [];
    const allActions: StageAction[] = [
        "upload", "submit", "modApprove", "modRevision", "resubmitMod",
        "clientApprove", "clientRevision", "resubmitClient", "paymentConfirmed",
    ];
    for (const action of allActions) {
        if (canTransition(status, action, role, clientRound, modRound)) actions.push(action);
    }
    return actions;
}

/** Результат «сдачи» специалистом — повторный POST после успеха должен не падать с 409 (двойной клик / две вкладки). */
const SPECIALIST_HANDOFF_TARGET: Partial<Record<StageAction, StageStatus>> = {
    submit: StageStatus.MOD_REVIEW,
    resubmitMod: StageStatus.MOD_REVIEW,
    resubmitClient: StageStatus.MOD_REVIEW,
};

/** Async transition — writes to DB */
export async function transition(
    stageId: string,
    action: StageAction,
    actorRole: Role,
    comment?: string,
    actorUserId?: string | null,
): Promise<StageStatus> {
    const stage = await prisma.projectStage.findUniqueOrThrow({
        where: {id: stageId},
        include: {
            order: {select: {id: true, status: true}},
            reviews: {select: {reviewerRole: true, verdict: true, createdAt: true}, orderBy: {createdAt: "desc"}},
        },
    });

    // Гейт старта работ: специалист не должен выполнять действия по этапам до активации заказа.
    if (actorRole === Role.SPECIALIST && stage.order.status !== OrderStatus.ACTIVE) {
        throw new ForbiddenError("Заказ ещё не активирован. Дождитесь подтверждения договора администратором.");
    }

    if (actorRole === Role.SPECIALIST) {
        const expected = getSpecialistSubmitAction(stage.status);
        const handoffTarget = SPECIALIST_HANDOFF_TARGET[action];
        if (handoffTarget !== undefined) {
            if (stage.status === handoffTarget && expected !== action) {
                return stage.status;
            }
            if (expected != null && expected !== action) {
                throw new TransitionError(`Для этапа в статусе «${stage.status}» сейчас доступно другое действие`);
            }
        }
    }

    if (actorRole === Role.CLIENT) {
        if (action === "clientApprove" && stage.status === StageStatus.APPROVED) {
            return stage.status;
        }
        if (
            action === "clientRevision" &&
            (stage.status === StageStatus.CLIENT_REVISION || stage.status === StageStatus.EXTRA_PAYMENT)
        ) {
            return stage.status;
        }
    }

    let nextStatus = getNextStatus(stage.status, action, actorRole, stage.clientRound, stage.modRound);

    // Always put moderator between client decision and next actor.
    // If we are in MOD_REVIEW and the latest review is CLIENT, admin decision routes either to APPROVED or to CLIENT_REVISION.
    if (stage.status === StageStatus.MOD_REVIEW && actorRole === Role.ADMIN && (action === "modApprove" || action === "modRevision")) {
        const latestClient = stage.reviews.find((r) => r.reviewerRole === "CLIENT") ?? null;
        if (latestClient) {
            if (action === "modApprove") {
                nextStatus = latestClient.verdict === "APPROVED" ? StageStatus.APPROVED : StageStatus.CLIENT_REVISION;
            } else {
                // Admin rejected client's decision: keep stage at client review.
                nextStatus = StageStatus.CLIENT_REVIEW;
            }
        }
    }

    const incrementModRound = stage.status === StageStatus.MOD_REVIEW && action === "modRevision" && nextStatus === StageStatus.MOD_REVISION;
    const incrementClientRound =
        stage.status === StageStatus.CLIENT_REVIEW && action === "clientRevision" && nextStatus === StageStatus.MOD_REVIEW;

    await prisma.$transaction(async (tx) => {
        // Optimistic concurrency guard (FUN3): only advance if the stage is still in
        // the status we read. Two concurrent transitions (double-click / two tabs)
        // would otherwise both apply — double-incrementing rounds or creating a second
        // StageAct. The status-conditional updateMany lets exactly one win; the loser
        // gets count===0 and we abort the whole transaction.
        const advanced = await tx.projectStage.updateMany({
            where: {id: stageId, status: stage.status},
            data: {
                status: nextStatus,
                ...(incrementModRound ? {modRound: {increment: 1}} : {}),
                ...(incrementClientRound ? {clientRound: {increment: 1}} : {}),
            },
        });
        if (advanced.count === 0) {
            throw new TransitionError("Этап уже был обновлён другим действием. Обновите страницу.");
        }

        const recordModeratorOrClientDecision =
            (actorRole === Role.CLIENT && (action === "clientApprove" || action === "clientRevision")) ||
            (actorRole === Role.ADMIN && (action === "modApprove" || action === "modRevision"));

        if (recordModeratorOrClientDecision) {
            await tx.stageReview.create({
                data: {
                    stageId,
                    reviewerRole: actorRole === Role.CLIENT ? "CLIENT" : "MODERATOR",
                    verdict: nextStatus === StageStatus.APPROVED || nextStatus === StageStatus.CLIENT_REVIEW ? "APPROVED" : "REJECTED",
                    comment: comment ?? null,
                },
            });
        }

        if (nextStatus === StageStatus.APPROVED) {
            await tx.stageAct.create({data: {stageId}});
        }
    });

    // Audit into order history (admin sidebar): stage progress should be visible there.
    try {
        await audit(actorUserId ?? null, "stage_status_changed", "Order", stage.orderId, {
            stageId: {to: stageId},
            stageType: {to: stage.type},
            stageStatus: {from: stage.status, to: nextStatus},
            stageAction: {to: action},
        });
    } catch {
        // Audit must not break the flow.
    }

    await syncStageSequentialLocks(stage.orderId);

    if (nextStatus === StageStatus.APPROVED) {
        const payment = await prisma.payment.findUnique({where: {stageId}});
        if (!isStagePaymentsDisabled() && payment?.tBankPaymentId && payment.status === PaymentStatus.HELD) {
            try {
                await releasePayment(payment.tBankPaymentId);
                await prisma.payment.update({
                    where: {id: payment.id},
                    data: {status: PaymentStatus.RELEASED},
                });
                console.log(`[billing] Funds released for stage ${stageId}, payment ${payment.tBankPaymentId}`);
            } catch (error) {
                console.error(`[billing] FAILED to release funds for stage ${stageId}:`, error);
            }
        }
        await activateNextStage(stage.orderId, stage.type);
    }

    // --- Notifications ---
    try {
        const order = await prisma.order.findUnique({
            where: {id: stage.orderId},
            select: {id: true, clientId: true, specialistId: true},
        });
        if (order) {
            const shortId = order.id.slice(-6).toUpperCase();
            const stageLabel = STAGE_LABELS_RU[stage.type as keyof typeof STAGE_LABELS_RU] ?? stage.type;
            const link = `/work/${order.id}`;

            if (nextStatus === StageStatus.MOD_REVISION && order.specialistId) {
                await notify(order.specialistId, "stage_revision", `Доработка: ${stageLabel}`, `Модератор вернул этап на доработку (заказ #${shortId})`, link);
            }
            if (nextStatus === StageStatus.CLIENT_REVISION && order.specialistId) {
                await notify(order.specialistId, "stage_revision", `Правки клиента: ${stageLabel}`, `Клиент запросил правки (заказ #${shortId})`, link);
                const admins = await prisma.user.findMany({where: {role: "ADMIN"}, select: {id: true}});
                for (const a of admins) {
                    await notify(
                        a.id,
                        "stage_revision",
                        `Правки клиента: ${stageLabel}`,
                        `Клиент запросил правки (заказ #${shortId})`,
                        `/admin/orders`,
                    );
                }
            }
            if (nextStatus === StageStatus.APPROVED && order.specialistId) {
                await notify(order.specialistId, "stage_approved", `Этап принят: ${stageLabel}`, `Заказ #${shortId}`, link);
            }
            if (nextStatus === StageStatus.CLIENT_REVIEW) {
                await notify(order.clientId, "stage_review", `На согласование: ${stageLabel}`, `Заказ #${shortId}`, `/orders/${order.id}`);
            }
            if (nextStatus === StageStatus.MOD_REVIEW) {
                const admins = await prisma.user.findMany({where: {role: "ADMIN"}, select: {id: true}});
                for (const a of admins) {
                    await notify(a.id, "stage_submitted", `На модерацию: ${stageLabel}`, `Специалист сдал этап (заказ #${shortId})`, `/admin/orders`);
                }
            }
            if (nextStatus === StageStatus.EXTRA_PAYMENT) {
                await notify(order.clientId, "extra_payment", `Доп. оплата: ${stageLabel}`, `Требуется оплата дополнительных правок (заказ #${shortId})`, `/orders/${order.id}`);
                if (order.specialistId) {
                    await notify(order.specialistId, "extra_payment", `Доп. оплата: ${stageLabel}`, `Ожидается оплата от клиента (заказ #${shortId})`, link);
                }
            }
        }
    } catch (e) {
        console.error("[notifications] Failed to send transition notification:", e);
    }

    return nextStatus;
}

export async function activateNextStage(orderId: string, currentType: string): Promise<void> {
    const idx = STAGE_ORDER.indexOf(currentType as (typeof STAGE_ORDER)[number]);
    if (idx === -1) return;

    if (idx < STAGE_ORDER.length - 1) return;

    if (await isOrderComplete(orderId)) {
        await prisma.order.update({where: {id: orderId}, data: {status: OrderStatus.DONE}});

        try {
            const order = await prisma.order.findUnique({
                where: {id: orderId},
                select: {clientId: true, specialistId: true}
            });
            if (order) {
                const shortId = orderId.slice(-6).toUpperCase();
                void notify(order.clientId, "order_done", "Проект завершен", `Все этапы заказа #${shortId} приняты. Проект завершен!`, `/orders/${orderId}`);
                if (order.specialistId) void notify(order.specialistId, "order_done", "Проект завершен", `Заказ #${shortId} завершен`, `/work/${orderId}`);
            }
        } catch (e) {
            console.error("[notifications] Failed to send order_done notification:", e);
        }
    }
}
