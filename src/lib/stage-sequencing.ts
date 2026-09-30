import type {ContractAudience, ContractStatus, StageType} from "@prisma/client";
import {prisma} from "@/lib/db/prisma";
import {STAGE_ORDER} from "@/lib/stage-constants";

/** Оба договора по заказу (со специалистом и с заказчиком) подтверждены администратором. */
export function bothOrderContractsConfirmed(
    contracts: ReadonlyArray<{ audience: ContractAudience; status: ContractStatus }>,
): boolean {
    const confirmed = (audience: ContractAudience) =>
        contracts.some((c) => c.audience === audience && c.status === "CONFIRMED");
    return confirmed("SPECIALIST") && confirmed("CLIENT");
}

/**
 * Выравнивает статусы этапов по цепочке: следующий этап в `PENDING` только когда все предыдущие `APPROVED`.
 * Иначе этап остаётся или переводится в `BLOCKED` (если был только ожиданием без работы).
 */
export async function syncStageSequentialLocks(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
        where: {id: orderId},
        select: {
            id: true,
            contracts: {select: {audience: true, status: true}},
            stages: {select: {id: true, type: true, status: true, act: {select: {status: true}}}},
        },
    });
    if (!order) return;

    const contractOk = bothOrderContractsConfirmed(order.contracts ?? []);

    const stages = order.stages ?? [];
    const byType = new Map<StageType, (typeof stages)[number]>();
    for (const s of stages) {
        byType.set(s.type, s);
    }

    for (let i = 0; i < STAGE_ORDER.length; i++) {
        const type = STAGE_ORDER[i] as StageType;
        const stage = byType.get(type);
        if (!stage) continue;

        const prevAllApprovedAndSettled = STAGE_ORDER.slice(0, i).every((t) => {
            const prev = byType.get(t as StageType);
            if (!prev) return false;
            if (prev.status !== "APPROVED") return false;
            // После APPROVED создаётся акт. Следующий этап открываем только после CONFIRMED (подтвержден админом).
            const actStatus = prev.act?.status ?? null;
            return actStatus == null || actStatus === "CONFIRMED";
        });

        if (stage.status === "APPROVED") continue;

        const canUnlock = contractOk && prevAllApprovedAndSettled;

        if (!canUnlock) {
            if (stage.status === "PENDING" || stage.status === "BLOCKED") {
                if (stage.status !== "BLOCKED") {
                    await prisma.projectStage.update({
                        where: {id: stage.id},
                        data: {status: "BLOCKED"},
                    });
                }
            }
        } else if (stage.status === "BLOCKED") {
            await prisma.projectStage.update({
                where: {id: stage.id},
                data: {status: "PENDING"},
            });
        }
    }
}
