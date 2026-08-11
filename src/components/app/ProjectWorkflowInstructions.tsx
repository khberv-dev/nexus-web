import React from "react"

export function ProjectWorkflowInstructions({defaultOpen = false}: { defaultOpen?: boolean }) {
    return (
        <div className="dash-surface-card" style={{marginTop: 12, padding: 0, overflow: "hidden"}}>
            <details open={defaultOpen}>
                <summary
                    style={{
                        listStyle: "none",
                        padding: "10px 12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        userSelect: "none",
                        background: "var(--dash-surface2)",
                        borderBottom: "1px solid var(--dash-border)",
                    }}
                >
          <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: "0.82rem",
              fontWeight: 700,
              color: "var(--dash-text)"
          }}>
            <i className="bx bx-info-circle" style={{color: "var(--dash-accent)", fontSize: "1.05rem"}}/>
            Как проходит работа по проекту
          </span>
                    <i className="bx bx-chevron-down" style={{color: "var(--dash-muted)"}}/>
                </summary>
                <div style={{padding: "10px 12px", fontSize: "0.82rem", color: "var(--dash-text2)", lineHeight: 1.55}}>
                    <div style={{marginBottom: 10}}>
                        <div style={{fontWeight: 700, color: "var(--dash-text)", marginBottom: 4}}>Этапы</div>
                        <div>
                            Проект идёт по этапам (концепция → планировка → визуализация → документация → спецификация).
                            Когда дизайнер сдаёт этап, он уходит на проверку, затем появится статус{" "}
                            <strong style={{color: "var(--dash-text)"}}>«Ожидает вашего решения»</strong> — тогда можно
                            принять этап или отправить на доработку.
                        </div>
                    </div>

                    <div style={{marginBottom: 10}}>
                        <div style={{fontWeight: 700, color: "var(--dash-text)", marginBottom: 4}}>Правки</div>
                        <div>
                            Замечания и вопросы пишите в чате с администратором — он передаст их дизайнеру и поможет
                            согласовать детали. После отправки на доработку дизайнер загрузит обновлённые материалы, и
                            этап
                            снова придёт к вам на согласование (после проверки администратором).
                        </div>
                    </div>

                    <div style={{marginBottom: 10}}>
                        <div style={{fontWeight: 700, color: "var(--dash-text)", marginBottom: 4}}>Инструкции</div>
                        <div>
                            Если для этапа есть инструкции (PDF), они доступны на странице самого этапа в блоке{" "}
                            <strong style={{color: "var(--dash-text)"}}>«Инструкции по этапу»</strong>.
                        </div>
                    </div>

                    <div>
                        <div style={{fontWeight: 700, color: "var(--dash-text)", marginBottom: 4}}>Оплата и счета</div>
                        <div>
                            Все счета и история оплат — в разделе <strong
                            style={{color: "var(--dash-text)"}}>«Оплата»</strong> (кнопка ниже). Если потребуется
                            доплата за дополнительные правки, система покажет
                            начисление и кнопку оплаты.
                        </div>
                    </div>
                </div>
            </details>
        </div>
    )
}

