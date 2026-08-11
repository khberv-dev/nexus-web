import {AuditTimeline} from "@/components/admin/AuditTimeline"

export function AuditCard({userId}: { userId: string }) {
    return (
        <div className="sp-card">
            <div className="sp-card-hd"><span className="sp-label">История изменений</span></div>
            <div className="sp-card-bd" style={{padding: "8px 12px"}}>
                <AuditTimeline entity="User" entityId={userId}/>
            </div>
        </div>
    )
}
