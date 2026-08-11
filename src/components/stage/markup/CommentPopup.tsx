import React, {useCallback, useEffect, useState} from "react"
import type {AnnotationBody, AnnotoriousImageAnnotator, ImageAnnotation, PopupProps} from "@annotorious/react"
import {useAnnotator} from "@annotorious/react"
import {commentPopupRoot} from "./constants"
import type {MarkupToastVariant} from "./types"

export type CommentPopupProps = Omit<PopupProps<ImageAnnotation>, "editable"> & {
    /** Разрешение приложения: заказчик в CLIENT_REVIEW и т.д. (у дизайнера всегда false). */
    allowMarkupEdit: boolean
    /** Что считает Annotorious редактируемым для текущего выделения. */
    selectionEditable: boolean
    showToast?: (message: string, variant: MarkupToastVariant) => void
}

export function CommentPopup(props: CommentPopupProps) {
    const {annotation, allowMarkupEdit, selectionEditable, onCreateBody, onUpdateBody, showToast} = props
    const canEdit = allowMarkupEdit && selectionEditable
    const anno = useAnnotator<AnnotoriousImageAnnotator>()
    const textBody = annotation.bodies?.find((b) => b.purpose === "commenting")
    const fromBody = typeof textBody?.value === "string" ? textBody.value : ""
    const [text, setText] = useState(fromBody)

    // Только смена области: иначе после onCreateBody/onUpdateBody срабатывает обновление bodies и затирает ввод.
    useEffect(() => {
        const b = annotation.bodies?.find((x) => x.purpose === "commenting")
        setText(typeof b?.value === "string" ? b.value : "")
    }, [annotation.id])

    const flush = useCallback((): "saved" | "unchanged" | "empty" => {
        const trimmed = text.trim()
        const body = annotation.bodies?.find((b) => b.purpose === "commenting")
        const current = typeof body?.value === "string" ? body.value : ""

        if (body) {
            if (trimmed !== current) {
                onUpdateBody(body, {...body, value: trimmed})
                return "saved"
            }
            if (!trimmed && !current) return "empty"
            return "unchanged"
        }
        if (trimmed) {
            onCreateBody({purpose: "commenting", value: trimmed} as Partial<AnnotationBody>)
            return "saved"
        }
        return "empty"
    }, [text, annotation.bodies, onCreateBody, onUpdateBody])

    const onSaveClick = () => {
        if (!canEdit) return
        const r = flush()
        if (r === "saved") showToast?.("Комментарий сохранен в этой области", "success")
        else if (r === "unchanged") showToast?.("Этот текст уже сохранен для области", "info")
        else showToast?.("Введите текст комментария и нажмите «Сохранить»", "info")
    }

    const onDeleteArea = () => {
        if (!anno || !canEdit) return
        if (
            !window.confirm(
                "Удалить эту область и комментарий к ней? Отправить изменения дизайнеру можно кнопкой «Сохранить пометки» под изображением.",
            )
        )
            return
        anno.removeAnnotation(annotation.id)
        anno.cancelSelected()
        showToast?.("Область удалена. Чтобы дизайнер увидел изменения, нажмите «Сохранить пометки» под изображением.", "info")
    }

    return (
        <div style={commentPopupRoot}>
            <div style={{
                fontSize: 11,
                fontWeight: 600,
                marginBottom: 6,
                color: "var(--dash-text, rgba(255,255,255,0.9))"
            }}>
                Комментарий к области
            </div>
            <textarea
                value={text}
                disabled={!canEdit}
                onChange={e => setText(e.target.value)}
                onBlur={() => {
                    if (canEdit) flush()
                }}
                rows={3}
                style={{
                    width: "100%",
                    fontSize: 13,
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                    borderRadius: 6,
                    border: "1px solid rgba(255, 255, 255, 0.18)",
                    padding: 8,
                    color: "var(--dash-text, rgba(255,255,255,0.95))",
                    background: canEdit ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.05)",
                    opacity: canEdit ? 1 : 0.85,
                }}
            />
            {canEdit ? (
                <>
                    <div style={{display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap"}}>
                        <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={onSaveClick}
                            style={{
                                padding: "6px 12px",
                                borderRadius: 6,
                                border: "none",
                                background: "var(--dash-accent, #2563eb)",
                                color: "#fff",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                                fontFamily: "inherit",
                            }}
                        >
                            Сохранить комментарий
                        </button>
                        <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={onDeleteArea}
                            style={{
                                padding: "6px 12px",
                                borderRadius: 6,
                                border: "1px solid rgba(239, 68, 68, 0.5)",
                                background: "rgba(239, 68, 68, 0.12)",
                                color: "#f87171",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                                fontFamily: "inherit",
                            }}
                        >
                            Удалить область
                        </button>
                    </div>
                    <p style={{
                        margin: "6px 0 0",
                        fontSize: 10,
                        color: "var(--dash-muted, rgba(255,255,255,0.62))",
                        lineHeight: 1.4
                    }}>
                        Чтобы отправить все пометки дизайнеру, внизу под картинкой нажмите «Сохранить пометки».
                    </p>
                </>
            ) : (
                <p style={{
                    margin: "8px 0 0",
                    fontSize: 11,
                    color: "var(--dash-muted, rgba(255,255,255,0.62))",
                    lineHeight: 1.45
                }}>
                    <strong style={{color: "var(--dash-text, rgba(255,255,255,0.9))"}}>Только
                        просмотр.</strong> Комментарии к областям может оставлять только
                    заказчик на этапе проверки результата; дизайнер здесь ничего не добавляет.
                </p>
            )}
        </div>
    )
}

