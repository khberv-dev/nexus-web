import type {OnboardingStatus} from "@/components/app/SpecialistCard"
import type {RawSpecialist} from "../../../types"

export function RatingLandingCard({
                                      specialistId,
                                      profile,
                                      onboardingStatus,
                                      ratingUpdating,
                                      onUpdateProfile,
                                  }: {
    specialistId: string
    profile?: RawSpecialist["specialistProfile"] | null
    onboardingStatus: OnboardingStatus
    ratingUpdating: boolean
    onUpdateProfile: (userId: string, patch: { rating?: number; featuredOnLanding?: boolean }) => void
}) {
    const isActiveSpec = onboardingStatus === "ACTIVE"

    return (
        <div className="sp-card">
            <div className="sp-card-hd"
                 style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
                <span className="sp-label">Оценка и лендинг</span>
                {!isActiveSpec && (
                    <span style={{fontSize: "0.68rem", color: "var(--adm-muted)", fontWeight: 400}}>редактирование после «Активен»</span>
                )}
            </div>
            <div className="sp-card-bd">
                <div className="sp-rating-section">
                    <div className="sp-info-label" style={{marginBottom: 8}}>Рейтинг</div>
                    <div className="sp-stars">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                type="button"
                                onClick={() => onUpdateProfile(specialistId, {rating: star})}
                                disabled={ratingUpdating || !isActiveSpec}
                                title={isActiveSpec ? `Поставить ${star}` : "Доступно для верифицированных"}
                                className={`sp-star${(profile?.rating ?? 0) >= star ? " sp-star--on" : ""}`}
                                style={{
                                    opacity: isActiveSpec ? 1 : 0.45,
                                    cursor: isActiveSpec ? "pointer" : "not-allowed"
                                }}
                            >
                                ★
                            </button>
                        ))}
                        <span className="sp-star-value">
              {typeof profile?.rating === "number" ? profile.rating.toFixed(1) : "не выставлен"}
            </span>
                    </div>
                </div>
                <div className="sp-landing-toggle" style={{marginTop: 10}}>
                    <label style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: isActiveSpec ? "pointer" : "default",
                        fontSize: "0.82rem"
                    }}>
                        <input
                            type="checkbox"
                            checked={profile?.featuredOnLanding ?? false}
                            onChange={() => onUpdateProfile(specialistId, {featuredOnLanding: !profile?.featuredOnLanding})}
                            disabled={ratingUpdating || !isActiveSpec}
                        />
                        Показывать на главной
                    </label>
                    <p style={{margin: "4px 0 0", fontSize: "0.7rem", color: "var(--adm-muted, #9ca3af)"}}>
                        Управляется через <a href="/admin/landing" style={{color: "var(--adm-active-color, #6366f1)"}}>модерацию
                        сборок</a>. Ручное переключение перезаписывает статус.
                    </p>
                </div>
            </div>
        </div>
    )
}
