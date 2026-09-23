import Link from "next/link"
import type {ProfileCompleteness} from "@/lib/profile-completeness"
import {Icon} from "@/components/ui/icon"
import {stripBx} from "@/lib/icon-map"

export default function ProfileCompletenessCard({completeness}: { completeness: ProfileCompleteness }) {
    const {steps, doneCount, percent} = completeness

    return (
        <section className="spec-dashboard__section spec-completeness"
                 aria-label="Заполненность профиля">
            <div className="spec-dashboard__section-header spec-completeness__header">
                <div>
                    <h2 className="spec-dashboard__section-title">
                        <Icon name="user-check"/> Заполните профиль
                    </h2>
                    <p className="spec-completeness__subtitle">
                        Осталось несколько шагов, чтобы клиенты увидели ваш профиль целиком
                    </p>
                </div>
                <span className="spec-completeness__count">{doneCount} из {steps.length}</span>
            </div>

            <div
                className="spec-completeness__bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-label={`Профиль заполнен на ${percent}%`}
            >
                <div className="spec-completeness__fill" style={{width: `${percent}%`}}/>
            </div>

            <ul className="spec-completeness__steps">
                {steps.map((step) => {
                    const state = step.done ? "done" : step.pending ? "pending" : "todo"
                    const icon = step.done ? "bx-check" : step.pending ? "bx-time-five" : "bx-plus"
                    return (
                        <li key={step.id} className={`spec-completeness__step spec-completeness__step--${state}`}>
                            <span className="spec-completeness__icon" aria-hidden><Icon name={stripBx(icon)}/></span>
                            <div className="spec-completeness__text">
                                <div className="spec-completeness__label">{step.label}</div>
                                {!step.done && <div className="spec-completeness__desc">{step.description}</div>}
                            </div>
                            {state === "todo" && (
                                <Link href={step.href} className="spec-completeness__action">
                                    Заполнить <Icon name="chevron-right"/>
                                </Link>
                            )}
                            {state === "pending" && <span className="spec-completeness__tag">На модерации</span>}
                            {state === "done" && <span className="spec-completeness__tag">Готово</span>}
                        </li>
                    )
                })}
            </ul>
        </section>
    )
}
