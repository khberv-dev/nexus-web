import type { RawSpecialist } from "../../../types"

export function PlatformMetaCard({ profile }: { profile: NonNullable<RawSpecialist["specialistProfile"]> }) {
  if (!profile.bio && !profile.videoUrl && !profile.landingWorkPos) return null

  return (
    <div className="sp-card">
      <div className="sp-card-hd"><span className="sp-label">Данные платформы (не из анкеты)</span></div>
      <div className="sp-card-bd">
        {profile.bio && (
          <div style={{ marginBottom: 12 }}>
            <div className="sp-info-label">Bio</div>
            <p className="sp-about-text" style={{ margin: "6px 0 0" }}>{profile.bio}</p>
          </div>
        )}
        {profile.videoUrl && (
          <div className="sp-info-item" style={{ marginBottom: 10 }}>
            <div className="sp-info-icon" style={{ background: "rgba(236,72,153,0.12)", color: "#ec4899" }}>
              <i className="bx bx-video" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="sp-info-label">Видео</div>
              <a href={profile.videoUrl} target="_blank" rel="noopener noreferrer" className="sp-info-link">{profile.videoUrl}</a>
            </div>
          </div>
        )}
        {profile.landingWorkPos && (
          <div style={{ fontSize: "0.82rem", color: "var(--adm-text)" }}>
            <span className="sp-info-label" style={{ display: "inline", marginRight: 6 }}>Позиция работы на лендинге:</span>
            {profile.landingWorkPos}
          </div>
        )}
      </div>
    </div>
  )
}
