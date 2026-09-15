"use client"

import {type DragEvent, type KeyboardEvent, useId, useRef, useState} from "react"
import {
    DEFAULT_DOCUMENT_ACCEPT,
    DEFAULT_DOCUMENT_MAX_SIZE,
    formatFileSize,
    validateDocumentFile,
} from "@/lib/document-file"
import styles from "./document-upload.module.css"

export type SubmittedDocument = {
    /** Имя отправленного файла, если известно. */
    name?: string | null
    /** ISO-дата отправки. */
    submittedAt?: string | null
    /** Подпись состояния; по умолчанию «Документ отправлен». */
    title?: string
    /** Пояснение под заголовком (например, «Ожидает проверки администратором»). */
    hint?: string
    onDownload?: () => void
}

type Props = {
    /** Выбранный, но ещё не отправленный файл. */
    file: File | null
    onFileChange: (file: File | null) => void
    label?: string
    /** Атрибут accept и допустимые расширения (через запятую, с точкой). */
    accept?: string
    /** Подсказка о формате под зоной выбора. */
    formatHint?: string
    maxSizeBytes?: number
    disabled?: boolean
    /** Процент загрузки 0–100, пока файл отправляется. */
    progress?: number | null
    /** Ошибка отправки от родителя (валидацию формата и размера компонент делает сам). */
    error?: string | null
    /**
     * Документ уже отправлен: форма блокируется и показывает, что именно загружено.
     * Выбрать другой файл в этом состоянии нельзя.
     */
    submitted?: SubmittedDocument | null
    size?: "md" | "sm"
    /** Цветовая схема: кабинет/онбординг (по умолчанию) или админка. */
    tone?: "dash" | "admin"
}

function formatDate(iso: string): string {
    const date = new Date(iso)
    return Number.isNaN(date.getTime())
        ? ""
        : date.toLocaleString("ru-RU", {day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"})
}

/** Зона выбора документа: перетаскивание или выбор, карточка файла, прогресс и заблокированное состояние после отправки. */
export function DocumentUpload({
                                   file,
                                   onFileChange,
                                   label,
                                   accept = DEFAULT_DOCUMENT_ACCEPT,
                                   formatHint,
                                   maxSizeBytes = DEFAULT_DOCUMENT_MAX_SIZE,
                                   disabled = false,
                                   progress = null,
                                   error = null,
                                   submitted = null,
                                   size = "md",
                                   tone = "dash",
                               }: Props) {
    const inputRef = useRef<HTMLInputElement>(null)
    const inputId = useId()
    const [dragOver, setDragOver] = useState(false)
    const [localError, setLocalError] = useState<string | null>(null)
    const uploading = progress !== null && progress !== undefined
    const locked = disabled || uploading || Boolean(submitted)
    const hint = formatHint ?? `PDF, до ${formatFileSize(maxSizeBytes)}`
    const shownError = localError ?? error

    const pick = (candidate: File | null | undefined) => {
        if (!candidate || locked) return
        const problem = validateDocumentFile(candidate, accept, maxSizeBytes)
        setLocalError(problem)
        if (!problem) onFileChange(candidate)
    }

    const openPicker = () => {
        if (!locked) inputRef.current?.click()
    }

    const onDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setDragOver(false)
        pick(e.dataTransfer.files?.[0])
    }

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            openPicker()
        }
    }

    const rootClass = [styles.root, size === "sm" && styles.sm, tone === "admin" && styles.admin].filter(Boolean).join(" ")

    if (submitted) {
        return (
            <div className={rootClass}>
                {label && <span className={styles.label}>{label}</span>}
                <div className={`${styles.box} ${styles.submitted}`} aria-disabled="true">
                    <span className={`${styles.icon} ${styles.iconDone}`} aria-hidden>
                        <i className="bx bx-check"/>
                    </span>
                    <div className={styles.meta}>
                        <span className={styles.title}>{submitted.title ?? "Документ отправлен"}</span>
                        <span className={styles.sub}>
                            {[submitted.name, submitted.submittedAt ? formatDate(submitted.submittedAt) : null]
                                .filter(Boolean).join(" · ") || submitted.hint || "Повторная загрузка недоступна"}
                        </span>
                        {submitted.hint && (submitted.name || submitted.submittedAt) && (
                            <span className={styles.sub}>{submitted.hint}</span>
                        )}
                    </div>
                    {submitted.onDownload && (
                        <button type="button" className={styles.action} onClick={submitted.onDownload}>
                            <i className="bx bx-download" aria-hidden/>
                            <span>Скачать</span>
                        </button>
                    )}
                    <i className={`bx bx-lock-alt ${styles.lock}`} title="Документ отправлен — изменить нельзя" aria-hidden/>
                </div>
            </div>
        )
    }

    return (
        <div className={rootClass}>
            {label && <label className={styles.label} htmlFor={inputId}>{label}</label>}
            <input
                ref={inputRef}
                id={inputId}
                type="file"
                accept={accept}
                className={styles.input}
                disabled={locked}
                onChange={(e) => {
                    pick(e.target.files?.[0])
                    e.target.value = ""
                }}
            />

            {file ? (
                <div className={`${styles.box} ${styles.selected} ${locked ? styles.locked : ""}`}>
                    <span className={styles.icon} aria-hidden><i className="bx bx-file"/></span>
                    <div className={styles.meta}>
                        <span className={styles.title} title={file.name}>{file.name}</span>
                        <span className={styles.sub}>
                            {uploading ? `Загрузка… ${Math.round(progress ?? 0)}%` : formatFileSize(file.size)}
                        </span>
                        {uploading && (
                            <span className={styles.progress} role="progressbar" aria-valuemin={0} aria-valuemax={100}
                                  aria-valuenow={Math.round(progress ?? 0)}>
                                <span style={{width: `${Math.min(100, Math.max(0, progress ?? 0))}%`}}/>
                            </span>
                        )}
                    </div>
                    {!locked && (
                        <>
                            <button type="button" className={styles.action} onClick={openPicker}>
                                <span>Заменить</span>
                            </button>
                            <button
                                type="button"
                                className={styles.remove}
                                onClick={() => {
                                    setLocalError(null)
                                    onFileChange(null)
                                }}
                                aria-label="Убрать файл"
                            >
                                <i className="bx bx-x" aria-hidden/>
                            </button>
                        </>
                    )}
                </div>
            ) : (
                <div
                    role="button"
                    tabIndex={locked ? -1 : 0}
                    aria-disabled={locked}
                    className={`${styles.box} ${styles.dropzone} ${dragOver ? styles.dragOver : ""} ${locked ? styles.locked : ""}`}
                    onClick={openPicker}
                    onKeyDown={onKeyDown}
                    onDragOver={(e) => {
                        e.preventDefault()
                        if (!locked) setDragOver(true)
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                >
                    <span className={styles.icon} aria-hidden><i className="bx bx-cloud-upload"/></span>
                    <div className={styles.meta}>
                        <span className={styles.title}>
                            Перетащите файл или <span className={styles.accent}>выберите на устройстве</span>
                        </span>
                        <span className={styles.sub}>{hint}</span>
                    </div>
                </div>
            )}

            {shownError && <p className={styles.error} role="alert">{shownError}</p>}
        </div>
    )
}
