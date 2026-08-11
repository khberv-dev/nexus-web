"use client"

/** Несколько ссылок хранятся в одном текстовом поле формы (formData.portfolio), по одной на строку. */
export function splitPortfolioLinks(value: string): string[] {
    return value.split("\n").map((v) => v.trim()).filter(Boolean)
}

const defaultAddButtonStyle: React.CSSProperties = {
    alignSelf: "flex-start",
    padding: "0.4em 0.9em",
    borderRadius: 8,
    border: "1px dashed currentColor",
    background: "transparent",
    color: "inherit",
    fontSize: "0.82rem",
    cursor: "pointer",
    fontFamily: "inherit",
    opacity: 0.75,
}

const defaultRemoveButtonStyle: React.CSSProperties = {
    flexShrink: 0,
    width: 28,
    height: 28,
    borderRadius: 6,
    border: "1px solid currentColor",
    opacity: 0.5,
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    fontFamily: "inherit",
    lineHeight: 1,
}

const defaultHintStyle: React.CSSProperties = {
    fontSize: "0.75rem",
    opacity: 0.55,
    color: "inherit",
}

export function PortfolioLinksField({
    value,
    onChange,
    inputStyle,
    placeholder = "https://behance.net/...",
    addLabel = "+ Добавить ссылку",
    addButtonStyle,
    removeButtonStyle,
    hint = "Добавьте ссылку на портфолио — Behance, Pinterest, личный сайт и т.д. Можно указать несколько ссылок.",
    hintStyle,
}: {
    value: string
    onChange: (value: string) => void
    inputStyle: React.CSSProperties
    placeholder?: string
    addLabel?: string
    addButtonStyle?: React.CSSProperties
    removeButtonStyle?: React.CSSProperties
    /** Текст подсказки под полем; передайте "" чтобы скрыть. */
    hint?: string
    hintStyle?: React.CSSProperties
}) {
    // Пустая строка в конце всегда даёт хотя бы одно поле ввода.
    const rawLines = value.split("\n")
    const links = rawLines.length > 0 ? rawLines : [""]

    const setLinks = (next: string[]) => onChange(next.join("\n"))

    const updateLink = (i: number, v: string) => {
        const next = [...links]
        next[i] = v
        setLinks(next)
    }
    const removeLink = (i: number) => {
        const next = links.filter((_, idx) => idx !== i)
        setLinks(next.length ? next : [""])
    }
    const addLink = () => setLinks([...links, ""])

    return (
        <div style={{ display: "grid", gap: 8 }}>
            {links.map((link, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                        type="url"
                        value={link}
                        placeholder={placeholder}
                        onChange={(e) => updateLink(i, e.target.value)}
                        style={{ ...inputStyle, flex: 1 }}
                    />
                    {links.length > 1 && (
                        <button
                            type="button"
                            onClick={() => removeLink(i)}
                            aria-label="Удалить ссылку"
                            style={removeButtonStyle ?? defaultRemoveButtonStyle}
                        >
                            ×
                        </button>
                    )}
                </div>
            ))}
            <button type="button" onClick={addLink} style={addButtonStyle ?? defaultAddButtonStyle}>
                {addLabel}
            </button>
            {hint && <div style={hintStyle ?? defaultHintStyle}>{hint}</div>}
        </div>
    )
}
