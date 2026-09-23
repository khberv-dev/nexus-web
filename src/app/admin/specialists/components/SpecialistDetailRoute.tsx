"use client"

import {useSpecialistsShell} from "../SpecialistsShell"
import {SpecialistDetail} from "./SpecialistDetail"
import {Icon} from "@/components/ui/icon"

/** Карточка специалиста по адресу /admin/specialists/:id[/:tab]; данные и действия — из списка в layout. */
export function SpecialistDetailRoute({id}: { id: string }) {
    const shell = useSpecialistsShell()
    const specialist = shell.specialists.find((s) => s.id === id) ?? null

    if (!specialist) {
        return (
            <div className="sp-detail-empty">
                <Icon name="user-circle"/>
                <p>{shell.loading ? "Загрузка..." : "Специалист не найден"}</p>
            </div>
        )
    }

    return (
        <SpecialistDetail
            specialist={specialist}
            detailTab={shell.detailTab}
            setDetailTab={shell.setDetailTab}
            acting={shell.acting}
            ratingUpdating={shell.ratingUpdating}
            ordersLoading={shell.ordersLoading}
            specOrders={shell.specOrders}
            onAct={shell.onAct}
            onUpdateProfile={shell.onUpdateProfile}
            onToggleArchive={shell.onToggleArchive}
            onRevokeSession={shell.onRevokeSession}
            setTestModal={shell.setTestModal}
            avatarUrl={shell.avatarUrls[specialist.id] ?? null}
            onRefresh={shell.onRefresh}
        />
    )
}
