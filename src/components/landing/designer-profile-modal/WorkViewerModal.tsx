"use client"

import {Modal} from "@/components/ui/modal"

interface WorkViewerModalProps {
    open: boolean
    works: string[]
    activeIndex: number
    activeSrc: string | null
    onClose: () => void
    onPrev: () => void
    onNext: () => void
}

export function WorkViewerModal({
                                    open,
                                    works,
                                    activeIndex,
                                    activeSrc,
                                    onClose,
                                    onPrev,
                                    onNext,
                                }: WorkViewerModalProps) {
    const navBtnStyle = {
        position: "absolute" as const,
        top: "50%",
        transform: "translateY(-50%)",
        width: 42,
        height: 42,
        borderRadius: "50%",
        background: "rgba(0,0,0,0.45)",
        border: "1px solid rgba(255,255,255,0.15)",
        color: "#fff",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "1.25rem",
    }

    return (
        <Modal open={open} onClose={onClose} maxWidth={1100} theme="dark">
            <div style={{position: "relative", background: "#0b0b10"}}>
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    borderBottom: "1px solid rgba(255,255,255,0.08)"
                }}>
                    <div style={{color: "rgba(255,255,255,0.65)", fontSize: "0.85rem"}}>
                        Работа {activeIndex + 1} / {works.length}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            background: "rgba(255,255,255,0.08)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 8,
                            color: "rgba(255,255,255,0.7)",
                            cursor: "pointer",
                            fontSize: "0.9rem",
                            padding: "0.3em 0.6em",
                            lineHeight: 1,
                        }}
                    >
                        ✕
                    </button>
                </div>

                <div style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "min(78vh, 720px)",
                    padding: 12
                }}>
                    {activeSrc && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                            src={activeSrc}
                            alt="Работа"
                            style={{
                                maxWidth: "100%",
                                maxHeight: "100%",
                                objectFit: "contain",
                                borderRadius: 14,
                                boxShadow: "0 24px 80px rgba(0,0,0,0.65)",
                            }}
                        />
                    )}

                    {works.length > 1 && (
                        <>
                            <button type="button" aria-label="Предыдущая работа" onClick={onPrev}
                                    style={{...navBtnStyle, left: 10}}>
                                ‹
                            </button>
                            <button type="button" aria-label="Следующая работа" onClick={onNext}
                                    style={{...navBtnStyle, right: 10}}>
                                ›
                            </button>
                        </>
                    )}
                </div>
            </div>
        </Modal>
    )
}
