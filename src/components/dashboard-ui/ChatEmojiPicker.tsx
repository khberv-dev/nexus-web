"use client"

import {useEffect, useRef, useState} from "react"

const EMOJI_CATEGORIES = [
    {
        label: "Частые",
        icon: "😀",
        emojis: "😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😋 😎 🤩 🥳 🥺 😭 😢 😤 😡 🤔 🤗 🤭 🫡 🫠 🙄 😴 🤯 😱 😬 😅 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💯 ✨ 🔥 🎉 ✅ ❌ 👍 👎 🙏 👏 💪 🤝 👌 ✌️ 🤞 👀".split(" "),
    },
    {
        label: "Люди",
        icon: "👋",
        emojis: "👋 🤚 🖐️ ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 🫶 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦾 🧠 👀 👁️ 👄 🧑 👩 👨 👶 🧒 👦 👧 🧑‍💻 👩‍💻 👨‍💻 🧑‍🎨 👩‍🎨 👨‍🎨".split(" "),
    },
    {
        label: "Животные",
        icon: "🐻",
        emojis: "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐻‍❄️ 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐒 🐔 🐧 🐦 🐤 🦄 🐝 🦋 🐌 🐞 🐢 🐍 🦎 🐙 🦑 🦀 🐠 🐟 🐬 🐳 🦈 🐊 🐅 🐆 🦓 🐘 🦒 🦘 🐕 🐈 🐾".split(" "),
    },
    {
        label: "Еда",
        icon: "🍕",
        emojis: "🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥝 🍅 🥑 🥦 🥕 🌽 🌶️ 🥐 🍞 🥨 🧀 🥚 🍳 🥞 🧇 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🥗 🍝 🍜 🍣 🍱 🍚 🍦 🍩 🍪 🎂 🍰 🍫 🍿 ☕ 🍵 🧃 🥤 🍺 🍷 🥂".split(" "),
    },
    {
        label: "Дела",
        icon: "⚽",
        emojis: "⚽ 🏀 🏈 ⚾ 🎾 🏐 🎱 🏓 🥊 🎯 🎮 🎲 🧩 🎨 🎭 🎤 🎧 🎸 🎹 🥁 🎬 📷 📱 💻 ⌨️ 🖥️ 🖨️ 💡 📚 ✏️ 📝 📌 📍 📎 📁 📊 📈 📉 💼 🏆 🥇 🎁 🎈 🎊 🎉 🚀 ✈️ 🚗 🚕 🚲 🏠 🏢 🌍 🌎 🌏".split(" "),
    },
    {
        label: "Символы",
        icon: "❤️",
        emojis: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❤️‍🔥 ❤️‍🩹 💕 💞 💓 💗 💖 💘 💝 💟 ☮️ ✝️ ☪️ 🕉️ ☯️ ✡️ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ 💯 💢 💥 💫 💦 💨 🕳️ 💬 🗨️ 🗯️ 💭 💤 ✅ ☑️ ✔️ ❌ ❗ ❓ ⚠️ 🚫 🔞 ⬆️ ➡️ ⬇️ ⬅️ 🔄 ➕ ➖ ➗ ♾️ ™️ ©️ ®️".split(" "),
    },
] as const

type ChatEmojiPickerProps = {
    disabled?: boolean
    onSelect: (emoji: string) => void
}

export function ChatEmojiPicker({disabled, onSelect}: ChatEmojiPickerProps) {
    const [open, setOpen] = useState(false)
    const [category, setCategory] = useState(0)
    const rootRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        const close = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
        }
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false)
        }
        document.addEventListener("mousedown", close)
        document.addEventListener("keydown", closeOnEscape)
        return () => {
            document.removeEventListener("mousedown", close)
            document.removeEventListener("keydown", closeOnEscape)
        }
    }, [open])

    return (
        <div ref={rootRef} style={{position: "relative", flexShrink: 0}}>
            <button
                type="button"
                aria-label="Добавить эмодзи"
                aria-expanded={open}
                title="Добавить эмодзи"
                disabled={disabled}
                onClick={() => setOpen(value => !value)}
                style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    border: "1px solid var(--dash-border)",
                    background: open ? "var(--dash-accent-bg)" : "var(--dash-surface2)",
                    color: "var(--dash-text)",
                    cursor: disabled ? "default" : "pointer",
                    fontSize: "1.2rem",
                    lineHeight: 1,
                    opacity: disabled ? 0.6 : 1,
                }}
            >
                <i className="bx bx-smile" aria-hidden/>
            </button>

            {open ? (
                <div
                    role="dialog"
                    aria-label="Выбор эмодзи"
                    style={{
                        position: "absolute",
                        right: 0,
                        bottom: "calc(100% + 8px)",
                        zIndex: 20,
                        width: "min(320px, calc(100vw - 32px))",
                        border: "1px solid var(--dash-border)",
                        borderRadius: 10,
                        background: "var(--dash-surface2)",
                        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.2)",
                        overflow: "hidden",
                    }}
                >
                    <div
                        role="tablist"
                        aria-label="Категории эмодзи"
                        style={{display: "flex", overflowX: "auto", borderBottom: "1px solid var(--dash-border)"}}
                    >
                        {EMOJI_CATEGORIES.map((item, index) => (
                            <button
                                key={item.label}
                                type="button"
                                role="tab"
                                aria-selected={category === index}
                                aria-label={item.label}
                                title={item.label}
                                onClick={() => setCategory(index)}
                                style={{
                                    flex: "1 0 42px",
                                    minWidth: 42,
                                    padding: "8px 6px",
                                    border: 0,
                                    borderBottom: category === index ? "2px solid var(--dash-accent)" : "2px solid transparent",
                                    background: category === index ? "var(--dash-accent-bg)" : "transparent",
                                    cursor: "pointer",
                                    fontSize: "1rem",
                                }}
                            >
                                {item.icon}
                            </button>
                        ))}
                    </div>
                    <div
                        role="tabpanel"
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(36px, 1fr))",
                            gap: 2,
                            maxHeight: 184,
                            overflowY: "auto",
                            padding: 8,
                            scrollbarWidth: "thin",
                        }}
                    >
                        {EMOJI_CATEGORIES[category].emojis.map((emoji, index) => (
                            <button
                                key={`${emoji}-${index}`}
                                type="button"
                                aria-label={`Добавить ${emoji}`}
                                onClick={() => onSelect(emoji)}
                                style={{
                                    height: 36,
                                    padding: 0,
                                    border: 0,
                                    borderRadius: 7,
                                    background: "transparent",
                                    cursor: "pointer",
                                    fontSize: "1.25rem",
                                    lineHeight: 1,
                                }}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    )
}
