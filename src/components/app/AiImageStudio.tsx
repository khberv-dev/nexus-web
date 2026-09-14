"use client"

import React, {useCallback, useEffect, useRef, useState} from "react"
import {createPortal} from "react-dom"
import {AiIcon} from "@/components/app/AiIcon"

export type AiImageStudioSource = {
    /** Исходник как data-url (аватар — свежий кадр из кроппера). */
    dataUrl?: string
    /** Либо id уже загруженного UserFile — тогда картинку читает сервер. */
    fileId?: string
    /** Что показывать в превью до первой генерации. */
    previewUrl: string
}

export type AiImageResult = { dataUrl: string; mimeType: string }

type Turn = { id: string; prompt: string; dataUrl: string; mimeType: string }

type Props = {
    open: boolean
    source: AiImageStudioSource
    /** Подмешивает на сервере правила кадра (квадрат для аватара, вертикаль для портрета). */
    context?: "avatar" | "portrait"
    title?: string
    /** Подпись кнопки применения. */
    applyLabel?: string
    /** Родитель сам грузит результат — пока промис не разрешится, показываем «Сохраняем…». */
    onApply: (result: AiImageResult) => void | Promise<void>
    onClose: () => void
}

const SUGGESTIONS = [
    "Сделай официальный деловой портрет: строгая одежда, светло-серый фон, мягкий студийный свет",
    "Нарисуй в стиле тёплой акварельной анимации: мягкие линии, природный свет, спокойный светлый фон",
    "Футуристичный портрет: минималистичный тёмный фон, тонкие сине-фиолетовые световые акценты",
    "Замени фон на ровный светлый студийный, остальное не трогай",
    "Выровняй свет и цвет кожи, убери лишние тени",
]

const MAX_PROMPT = 600

export default function AiImageStudio({open, source, context, title, applyLabel, onApply, onClose}: Props) {
    const [mounted, setMounted] = useState(false)
    const [turns, setTurns] = useState<Turn[]>([])
    const [activeId, setActiveId] = useState<string>("original")
    const [prompt, setPrompt] = useState("")
    const [loading, setLoading] = useState(false)
    const [applying, setApplying] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const stripRef = useRef<HTMLDivElement>(null)

    useEffect(() => setMounted(true), [])

    // Новый исходник — новый диалог.
    useEffect(() => {
        if (!open) return
        setTurns([])
        setActiveId("original")
        setPrompt("")
        setError(null)
        setNotice(null)
        const t = window.setTimeout(() => inputRef.current?.focus(), 60)
        return () => window.clearTimeout(t)
    }, [open, source.dataUrl, source.fileId])

    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !loading && !applying) onClose()
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [open, loading, applying, onClose])

    const activeTurn = turns.find((t) => t.id === activeId) ?? null
    const activePreview = activeTurn?.dataUrl ?? source.previewUrl

    const generate = useCallback(async (rawPrompt: string) => {
        const text = rawPrompt.replace(/\s+/g, " ").trim()
        if (!text || loading) return
        if (text.length > MAX_PROMPT) {
            setError(`Запрос длиннее ${MAX_PROMPT} символов`)
            return
        }
        setLoading(true)
        setError(null)
        try {
            // Правим то, что сейчас на экране: цепочка правок, а не всегда исходник.
            const body: Record<string, unknown> = {prompt: text, context}
            if (activeTurn) body.image = activeTurn.dataUrl
            else if (source.dataUrl) body.image = source.dataUrl
            else if (source.fileId) body.fileId = source.fileId
            else throw new Error("Нет исходного изображения")

            const res = await fetch("/api/ai/image-edit", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(body),
            })
            const data = await res.json().catch(() => ({})) as {
                image?: AiImageResult
                error?: string
                sourceImageUsed?: boolean
            }
            if (!res.ok) throw new Error(data.error ?? "Не удалось обработать изображение")
            if (!data.image?.dataUrl) throw new Error("Модель не вернула изображение")

            const turn: Turn = {
                id: `${Date.now()}-${turns.length}`,
                prompt: text,
                dataUrl: data.image.dataUrl,
                mimeType: data.image.mimeType || "image/jpeg",
            }
            setTurns((prev) => [...prev, turn])
            setActiveId(turn.id)
            setPrompt("")
            setNotice(data.sourceImageUsed === false
                ? "Текущий AI-провайдер рисует картинку с нуля по описанию и не использует исходное фото."
                : null)
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось обработать изображение")
        } finally {
            setLoading(false)
        }
    }, [activeTurn, context, loading, source.dataUrl, source.fileId, turns.length])

    // Новый результат — прокручиваем ленту к нему.
    useEffect(() => {
        if (turns.length === 0) return
        stripRef.current?.scrollTo({left: stripRef.current.scrollWidth, behavior: "smooth"})
    }, [turns.length])

    const handleApply = async () => {
        if (!activeTurn || applying) return
        setApplying(true)
        try {
            await onApply({dataUrl: activeTurn.dataUrl, mimeType: activeTurn.mimeType})
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось сохранить изображение")
        } finally {
            setApplying(false)
        }
    }

    if (!mounted || !open) return null

    const busy = loading || applying

    return createPortal(
        <div className="ai-studio__backdrop" onClick={() => !busy && onClose()}>
            <AiImageStudioStyles/>
            <div className="ai-studio" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                <header className="ai-studio__hd">
                    <div className="ai-studio__hd-title">
                        <AiIcon/>
                        <span>{title ?? "Редактор фото с ИИ"}</span>
                    </div>
                    <button type="button" className="ai-studio__close" onClick={onClose} disabled={busy}
                            aria-label="Закрыть">
                        <i className="bx bx-x"/>
                    </button>
                </header>

                <div className="ai-studio__stage">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={activePreview} alt="" className="ai-studio__stage-img"/>
                    {loading && (
                        <div className="ai-studio__stage-veil">
                            <i className="bx bx-loader-alt bx-spin"/>
                            <span>Генерируем…</span>
                            <small>Это занимает до полуминуты</small>
                        </div>
                    )}
                </div>

                <div className="ai-studio__strip" ref={stripRef}>
                    <button type="button"
                            className={`ai-studio__thumb ${activeId === "original" ? "is-active" : ""}`}
                            onClick={() => setActiveId("original")} disabled={busy} title="Исходное фото">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={source.previewUrl} alt=""/>
                        <span>Оригинал</span>
                    </button>
                    {turns.map((turn, i) => (
                        <button key={turn.id} type="button"
                                className={`ai-studio__thumb ${activeId === turn.id ? "is-active" : ""}`}
                                onClick={() => setActiveId(turn.id)} disabled={busy} title={turn.prompt}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={turn.dataUrl} alt=""/>
                            <span>Шаг {i + 1}</span>
                        </button>
                    ))}
                </div>

                {activeTurn && <p className="ai-studio__echo" title={activeTurn.prompt}>«{activeTurn.prompt}»</p>}

                {notice && <div className="ai-studio__notice"><i className="bx bx-info-circle"/>{notice}</div>}
                {error && <div className="ai-studio__error"><i className="bx bx-error-circle"/>{error}</div>}

                <div className="ai-studio__suggest">
                    {SUGGESTIONS.map((s) => (
                        <button key={s} type="button" className="ai-studio__chip" disabled={busy}
                                onClick={() => void generate(s)} title={s}>
                            {s.split(":")[0].split(",")[0]}
                        </button>
                    ))}
                </div>

                <form
                    className="ai-studio__composer"
                    onSubmit={(e) => {
                        e.preventDefault()
                        void generate(prompt)
                    }}
                >
                    <textarea
                        ref={inputRef}
                        className="ai-studio__input"
                        value={prompt}
                        maxLength={MAX_PROMPT}
                        rows={2}
                        disabled={busy}
                        placeholder={activeTurn
                            ? "Что поправить в этом варианте? Например: «сделай фон темнее»"
                            : "Опишите, что сделать с фото. Например: «деловой портрет на светлом фоне»"}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                e.preventDefault()
                                void generate(prompt)
                            }
                        }}
                    />
                    <button type="submit" className="ai-studio__send" disabled={busy || prompt.trim().length === 0}>
                        <i className={`bx ${loading ? "bx-loader-alt bx-spin" : "bx-send"}`}/>
                        <span>{loading ? "Генерируем…" : "Применить запрос"}</span>
                    </button>
                </form>

                <footer className="ai-studio__ft">
                    <span className="ai-studio__hint">
                        {activeTurn ? "Выбран результат ИИ" : "Выберите или создайте вариант"}
                    </span>
                    <div className="ai-studio__ft-actions">
                        <button type="button" className="ai-studio__cancel" onClick={onClose} disabled={busy}>
                            Отмена
                        </button>
                        <button type="button" className="ai-studio__apply" onClick={() => void handleApply()}
                                disabled={busy || !activeTurn}>
                            <i className={`bx ${applying ? "bx-loader-alt bx-spin" : "bx-check"}`}/>
                            {applying ? "Сохраняем…" : (applyLabel ?? "Применить")}
                        </button>
                    </div>
                </footer>
            </div>
        </div>,
        document.body,
    )
}

function AiImageStudioStyles() {
    return (
        <style>{`
      .ai-studio__backdrop {
        position: fixed; inset: 0; z-index: 10050;
        background: rgba(12,13,20,0.72); backdrop-filter: blur(3px);
        display: flex; align-items: center; justify-content: center; padding: 16px;
      }
      .ai-studio {
        width: min(560px, 100%); max-height: min(92vh, 880px);
        display: flex; flex-direction: column; gap: 10px;
        padding: 14px 16px 16px;
        border-radius: 16px; overflow-y: auto;
        background: var(--dash-surface, #1b1c27);
        border: 1px solid rgba(255,255,255,0.08);
        color: #f2f2f7;
        box-shadow: 0 24px 60px rgba(0,0,0,0.45);
      }
      .ai-studio__hd { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .ai-studio__hd-title { display: flex; align-items: center; gap: 7px; font-weight: 600; font-size: 0.95rem; }
      .ai-studio__hd-title svg { color: #a78bfa; width: 1.1rem; height: 1.1rem; }
      .ai-studio__close {
        border: 0; background: transparent; color: rgba(255,255,255,0.6);
        font-size: 1.35rem; line-height: 1; cursor: pointer; padding: 2px 4px; border-radius: 8px;
      }
      .ai-studio__close:hover:not(:disabled) { color: #fff; background: rgba(255,255,255,0.08); }

      .ai-studio__stage {
        position: relative; border-radius: 12px; overflow: hidden;
        background: rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center;
        min-height: 200px; max-height: 42vh;
      }
      .ai-studio__stage-img { max-width: 100%; max-height: 42vh; object-fit: contain; display: block; }
      .ai-studio__stage-veil {
        position: absolute; inset: 0; display: flex; flex-direction: column; gap: 4px;
        align-items: center; justify-content: center; background: rgba(10,10,16,0.72); text-align: center;
      }
      .ai-studio__stage-veil i { font-size: 1.6rem; color: #a78bfa; }
      .ai-studio__stage-veil span { font-size: 0.85rem; font-weight: 500; }
      .ai-studio__stage-veil small { font-size: 0.72rem; color: rgba(255,255,255,0.6); }

      .ai-studio__strip { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; }
      .ai-studio__thumb {
        flex: 0 0 auto; width: 64px; padding: 0; cursor: pointer; font-family: inherit;
        background: transparent; border: 2px solid rgba(255,255,255,0.16); border-radius: 10px; overflow: hidden;
      }
      .ai-studio__thumb.is-active { border-color: #a78bfa; box-shadow: 0 0 0 3px rgba(167,139,250,0.22); }
      .ai-studio__thumb:disabled { cursor: default; opacity: 0.7; }
      .ai-studio__thumb img { width: 100%; height: 60px; object-fit: cover; display: block; }
      .ai-studio__thumb span {
        display: block; font-size: 0.63rem; padding: 3px 2px; text-align: center;
        color: rgba(255,255,255,0.65); white-space: nowrap;
      }
      .ai-studio__thumb.is-active span { color: #c4b5fd; font-weight: 600; }

      .ai-studio__echo {
        margin: 0; font-size: 0.74rem; color: rgba(255,255,255,0.55); font-style: italic;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }

      .ai-studio__notice, .ai-studio__error {
        display: flex; align-items: flex-start; gap: 6px;
        padding: 8px 10px; border-radius: 9px; font-size: 0.76rem; line-height: 1.45;
      }
      .ai-studio__notice { border: 1px solid rgba(255,159,67,0.35); background: rgba(255,159,67,0.1); color: #ffbe7d; }
      .ai-studio__error { border: 1px solid rgba(234,84,85,0.4); background: rgba(234,84,85,0.1); color: #ff9d9e; }

      .ai-studio__suggest { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; }
      .ai-studio__chip {
        flex: 0 0 auto; cursor: pointer; font-family: inherit; font-size: 0.73rem;
        padding: 5px 10px; border-radius: 999px; white-space: nowrap;
        border: 1px solid rgba(167,139,250,0.35); background: rgba(167,139,250,0.1); color: #c4b5fd;
      }
      .ai-studio__chip:hover:not(:disabled) { background: rgba(167,139,250,0.2); }
      .ai-studio__chip:disabled { opacity: 0.5; cursor: default; }

      .ai-studio__composer { display: flex; flex-direction: column; gap: 8px; }
      .ai-studio__input {
        width: 100%; resize: vertical; font-family: inherit; font-size: 0.85rem; line-height: 1.5;
        padding: 9px 11px; border-radius: 10px; color: #f2f2f7;
        border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05);
      }
      .ai-studio__input:focus { outline: none; border-color: rgba(167,139,250,0.6); }
      .ai-studio__input::placeholder { color: rgba(255,255,255,0.4); }
      .ai-studio__send {
        align-self: flex-start; display: inline-flex; align-items: center; gap: 6px;
        padding: 7px 14px; border-radius: 9px; cursor: pointer; font-family: inherit;
        font-size: 0.82rem; font-weight: 500;
        border: 1px solid rgba(167,139,250,0.45); background: rgba(167,139,250,0.16); color: #c4b5fd;
      }
      .ai-studio__send:disabled { opacity: 0.5; cursor: default; }

      .ai-studio__ft {
        display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
        border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px;
      }
      .ai-studio__hint { font-size: 0.74rem; color: rgba(255,255,255,0.5); }
      .ai-studio__ft-actions { display: flex; gap: 8px; margin-left: auto; }
      .ai-studio__cancel, .ai-studio__apply {
        display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-family: inherit;
        padding: 8px 16px; border-radius: 9px; font-size: 0.83rem; font-weight: 500;
      }
      .ai-studio__cancel { border: 1px solid rgba(255,255,255,0.18); background: transparent; color: rgba(255,255,255,0.75); }
      .ai-studio__apply { border: 0; background: #5b4fcf; color: #fff; }
      .ai-studio__apply:disabled, .ai-studio__cancel:disabled { opacity: 0.5; cursor: default; }

      @media (max-width: 480px) {
        .ai-studio { padding: 12px; border-radius: 14px; }
        .ai-studio__ft-actions { width: 100%; }
        .ai-studio__apply, .ai-studio__cancel { flex: 1 1 0; justify-content: center; }
      }
    `}</style>
    )
}
