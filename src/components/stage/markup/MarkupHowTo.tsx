import React, { useState } from "react"
import { instructionCard } from "./constants"

export function MarkupHowTo({ editable }: { editable: boolean }) {
  const [open, setOpen] = useState(true)

  return (
    <div style={instructionCard}>
      <button
        type="button"
        id="markup-howto-toggle"
        aria-expanded={open}
        aria-controls="markup-howto-panel"
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          gap: 10,
          background: "transparent",
          border: "none",
          padding: "4px 0",
          margin: 0,
          cursor: "pointer",
          font: "inherit",
          textAlign: "left",
          borderRadius: 6,
        }}
      >
        <span
          aria-hidden
          style={{
            flexShrink: 0,
            width: "1.1em",
            color: "var(--dash-muted, rgba(255,255,255,0.62))",
            fontSize: "0.65rem",
            lineHeight: 1,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {open ? "▼" : "▶"}
        </span>
        <span style={{ flex: 1, fontWeight: 600, color: "var(--dash-text, rgba(255,255,255,0.95))" }}>
          Как пользоваться разметкой на изображении
        </span>
        <span
          style={{
            flexShrink: 0,
            fontSize: "0.7rem",
            fontWeight: 600,
            color: "var(--dash-accent, #60a5fa)",
            textDecoration: "underline",
            textUnderlineOffset: 2,
            whiteSpace: "nowrap",
          }}
        >
          {open ? "Свернуть" : "Развернуть"}
        </span>
      </button>
      <ol
        id="markup-howto-panel"
        role="region"
        aria-labelledby="markup-howto-toggle"
        hidden={!open}
        style={{
          margin: "10px 0 0",
          paddingLeft: 20,
          paddingTop: open ? 10 : 0,
          borderTop: open ? "1px solid rgba(15, 23, 42, 0.08)" : "none",
          color: "var(--dash-muted, rgba(255,255,255,0.66))",
        }}
      >
        <li style={{ marginBottom: 6 }}>
          Зажмите кнопку мыши на изображении и протяните прямоугольник вокруг фрагмента, к которому относится комментарий.
        </li>
        <li style={{ marginBottom: 6 }}>
          В окне «Комментарий к области» опишите правку и нажмите «Сохранить комментарий» (или кликните вне поля — тоже
          сохранится). Это фиксирует текст в рамке на картинке.
        </li>
        <li style={{ marginBottom: 6 }}>
          Чтобы изменить текст, кликните по уже нарисованной рамке — окно откроется снова. Ненужную область можно удалить
          кнопкой «Удалить область» в том же окне.
        </li>
        {editable ? (
          <li>
            Черновик пометок периодически сохраняется на сервер сам; после обновления страницы они подтянутся снова. Кнопка
            «Сохранить пометки» — явное сохранение и сигнал дизайнеру.
          </li>
        ) : (
          <li>
            Здесь отображаются сохраненные пометки. Добавить или править области может заказчик на этапе проверки
            результата.
          </li>
        )}
      </ol>
    </div>
  )
}

