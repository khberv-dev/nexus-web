"use client"

import {useCallback, useEffect, useState} from "react"
import {Annotorious} from "@annotorious/react"

import "@annotorious/annotorious/annotorious.css"

import {markupHintColor, markupPopupZIndexCss} from "./markup/constants"
import type {MarkupToastVariant} from "./markup/types"
import {MarkupToaster} from "./markup/MarkupToaster"
import {MarkupHowTo} from "./markup/MarkupHowTo"
import {MarkupCanvas} from "./markup/MarkupCanvas"

export type StageImageMarkupProps = {
    stageId: string
    fileId: string
    filename: string
    /** Рисование и сохранение — только у заказчика в статусе CLIENT_REVIEW (передается снаружи). */
    editable: boolean
    /** Если editable=false, показываем причину (чтобы не гадать). */
    readonlyReason?: string
    /** Закрыть контейнер (обычно модалку превью). */
    onClose?: () => void
}

export default function StageImageMarkup({
                                             stageId,
                                             fileId,
                                             filename,
                                             editable,
                                             readonlyReason,
                                             onClose
                                         }: StageImageMarkupProps) {
    const [origin, setOrigin] = useState("")
    const [toast, setToast] = useState<{ message: string; variant: MarkupToastVariant } | null>(null)

    const showMarkupToast = useCallback((message: string, variant: MarkupToastVariant) => {
        setToast({message, variant})
    }, [])

    useEffect(() => {
        setOrigin(window.location.origin)
    }, [])

    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => setToast(null), 3400)
        return () => clearTimeout(t)
    }, [toast])

    if (!origin) {
        return <p style={{fontSize: "0.78rem", color: markupHintColor}}>Загрузка просмотра…</p>
    }

    const imageUrl = `${origin}/api/stages/${stageId}/files/${fileId}/download`

    return (
        <div
            className="stage-image-markup-root"
            style={{
                marginTop: 8,
                padding: 12,
                borderRadius: 10,
                border: "1px solid var(--dash-border)",
                background: "var(--dash-surface2, rgba(0,0,0,0.02))",
                position: "relative",
            }}
        >
            <style>{markupPopupZIndexCss}</style>
            <MarkupToaster toast={toast}/>
            <div style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 10
            }}>
                <div style={{minWidth: 0}}>
                    <div style={{fontSize: "0.85rem", fontWeight: 700, color: "var(--dash-text)"}}>Разметка
                        изображения
                    </div>
                </div>
                {onClose ? (
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            flexShrink: 0,
                            padding: "6px 10px",
                            borderRadius: 8,
                            border: "1px solid var(--dash-border)",
                            background: "var(--dash-surface)",
                            color: "var(--dash-text2)",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            fontFamily: "inherit",
                        }}
                    >
                        Закрыть
                    </button>
                ) : null}
            </div>
            {!editable && readonlyReason ? (
                <div
                    style={{
                        marginBottom: 12,
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid rgba(245, 158, 11, 0.35)",
                        background: "rgba(245, 158, 11, 0.10)",
                        color: "var(--dash-text, rgba(255,255,255,0.92))",
                        fontSize: "0.8rem",
                        lineHeight: 1.45,
                    }}
                >
                    <strong style={{color: "var(--dash-warn, #ff9f43)"}}>Разметка недоступна для
                        редактирования.</strong>{" "}
                    {readonlyReason}
                </div>
            ) : null}
            <MarkupHowTo editable={editable}/>
            <Annotorious>
                <MarkupCanvas
                    stageId={stageId}
                    fileId={fileId}
                    filename={filename}
                    editable={editable}
                    imageUrl={imageUrl}
                    showToast={showMarkupToast}
                />
            </Annotorious>
        </div>
    )
}
