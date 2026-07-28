"use client"

import ProfileForm from "@/app/(dashboard)/work/profile/ProfileForm"
import type { OnboardingStep } from "./types"
import { ONBOARDING_STEPS } from "./types"

export function SettingsCol1({ name, email, city, experience, software, about, status, onboardingSteps }: {
  name: string; email: string; city?: string; experience?: string; software?: string
  about?: string; status?: string; onboardingSteps: OnboardingStep[]
}) {
  const isActive = status === "ACTIVE"
  const passedSteps = new Set(onboardingSteps.filter(s => s.status === "PASSED").map(s => s.type))

  const metaItems = [
    { label: "Email",    value: email,      icon: "bx-envelope" },
    { label: "Город",    value: city,       icon: "bx-map" },
    { label: "Опыт",     value: experience ? `${experience} лет` : undefined, icon: "bx-briefcase" },
    { label: "Программы",value: software,   icon: "bx-wrench" },
    { label: "О себе",   value: about,      icon: "bx-user" },
    { label: "Статус",   value: isActive ? "Верифицирован" : "На верификации", icon: isActive ? "bx-shield-check" : "bx-time" },
  ].filter(i => i.value)

  return (
    <>
      <div className="dash-list-heading-wrap">
        <h2 className="dash-list-heading">Профиль</h2>
      </div>
      <ul className="dash-list">
        {metaItems.map(item => (
          <li key={item.label} className="dash-list__item" style={{ cursor: "default" }}>
            <div className="dash-list__thumb" style={{ background: "var(--dash-accent-bg)", color: "var(--dash-accent)" }}>
              <i className={`bx ${item.icon}`} style={{ fontSize: 16 }} />
            </div>
            <div className="dash-list__wrap">
              <p className="dash-list__content">{item.value}</p>
              <p className="dash-list__sub">{item.label}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="dash-list-heading-wrap" style={{ marginTop: 14 }}>
        <h2 className="dash-list-heading">Верификация</h2>
      </div>
      <ul className="dash-steps">
        {ONBOARDING_STEPS.map((step, i) => {
          const done = passedSteps.has(step.key)
          const stepData = onboardingSteps.find(s => s.type === step.key)
          const failed = stepData?.status === "FAILED"
          return (
            <li key={step.key} className="dash-step">
              <div className={`dash-step__dot ${done ? "dash-step__dot--done" : failed ? "dash-step__dot--failed" : "dash-step__dot--todo"}`}>
                {done ? <i className="bx bx-check" /> : failed ? <i className="bx bx-x" /> : i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ color: done ? "var(--dash-text)" : failed ? "var(--dash-danger, #ea5455)" : "var(--dash-muted)", fontSize: 13 }}>{step.label}</span>
                {failed && stepData?.comment && (
                  <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "var(--dash-danger, #ea5455)", lineHeight: 1.4 }}>
                    <i className="bx bx-error-circle" style={{ marginRight: 4, verticalAlign: "middle" }} />
                    {stepData.comment}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}

export function SettingsCol2({ name, email, formData, status, onboardingSteps, featuredOnLanding }: {
  name: string; email: string
  formData: Record<string, string> | null
  status?: string
  onboardingSteps: OnboardingStep[]
  featuredOnLanding?: boolean
}) {
  const isActive = status === "ACTIVE"
  const hasAbout = !!formData?.about?.trim()
  const passedSteps = new Set(onboardingSteps.filter(s => s.status === "PASSED").map(s => s.type))
  const hideTaxAndRequisites = passedSteps.has("CONTRACT") || isActive

  return (
    <>
      {/* Profile form */}
      <div className="dash-settings-card">
        <div className="dash-settings-card__hd">
          <i className="bx bx-edit" style={{ color: "var(--dash-accent)" }} />
          Редактировать данные
        </div>
        <ProfileForm initialData={formData ?? {}} hideTaxAndRequisites={hideTaxAndRequisites} />
      </div>

      {/* Landing status */}
      <div className="dash-settings-card" style={{ borderColor: featuredOnLanding ? "var(--dash-success)" : "var(--dash-border)" }}>
        <div className="dash-settings-card__hd">
          <i className="bx bx-globe" style={{ color: featuredOnLanding ? "var(--dash-success)" : "var(--dash-muted)" }} />
          На главной странице
        </div>
        <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--dash-muted)" }}>
          {featuredOnLanding
            ? "Ваш профиль виден клиентам в карусели специалистов."
            : "Модератор добавит вас на лендинг после верификации."}
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {[
            { done: isActive,  label: "Верифицирован" },
            { done: hasAbout,  label: "Заполнено «О себе»" },
          ].map(item => (
            <li key={item.label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", fontSize: 12.5 }}>
              <i className={`bx ${item.done ? "bx-check" : "bx-x"}`} style={{ color: item.done ? "var(--dash-success)" : "var(--dash-muted)" }} />
              <span style={{ color: item.done ? "var(--dash-text)" : "var(--dash-muted)" }}>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>

    </>
  )
}
