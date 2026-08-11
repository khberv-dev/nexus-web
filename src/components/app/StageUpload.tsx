"use client"

import {useCallback, useMemo, useRef, useState} from "react"
import {useRouter} from "next/navigation"
import type {StageType} from "@prisma/client"

type UploadFile = {
    file: File
    progress: number
    status: "pending" | "uploading" | "error" | "done"
}

const BASE_ACCEPT = ".pdf,.dwg,.dxf,.jpg,.jpeg,.png,.zip,.mp4";
const SPEC_ACCEPT_EXTRA = ",.xlsx,.xls,.doc,.docx";

export function StageUpload({
                                stageId,
                                canUpload,
                                stageType,
                                submitStage,
                            }: {
    stageId: string;
    canUpload: boolean;
    stageType?: StageType;
    /** Если передан — одна точка сдачи этапа (обновление заказа у родителя, те же ошибки API). */
    submitStage?: (stageId: string) => Promise<{ ok: boolean; error?: string; status?: string }>;
}) {
    const router = useRouter()
    const inputRef = useRef<HTMLInputElement>(null)
    const videoRef = useRef<HTMLInputElement>(null)
    const [files, setFiles] = useState<UploadFile[]>([])
    const [video, setVideo] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [doneHint, setDoneHint] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const [dragOver, setDragOver] = useState(false)

    const fileAccept = useMemo(
        () => (stageType === "SPECIFICATION" ? BASE_ACCEPT + SPEC_ACCEPT_EXTRA : BASE_ACCEPT),
        [stageType],
    );
    const formatsHint = useMemo(() => {
        const base = "PDF, DWG, DXF, JPG, PNG, ZIP, MP4 — до 500 МБ";
        return stageType === "SPECIFICATION"
            ? `${base}; для спецификации также XLSX, XLS, DOC, DOCX`
            : base;
    }, [stageType]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const droppedFiles = Array.from(e.dataTransfer.files).map(f => ({
            file: f,
            progress: 0,
            status: "pending" as const
        }))
        if (droppedFiles.length) setFiles(prev => [...prev, ...droppedFiles])
    }, [])

    const handleFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newFiles = Array.from(e.target.files ?? []).map(f => ({
            file: f,
            progress: 0,
            status: "pending" as const,
        }))
        setFiles(prev => [...prev, ...newFiles])
        e.target.value = ""
    }, [])

    const remove = useCallback((i: number) => {
        setFiles(prev => {
            const newFiles = prev.filter((_, idx) => idx !== i)
            return newFiles
        })
    }, [])

    const [uploaded, setUploaded] = useState(false)

    if (!canUpload) return null

    /** Загрузка на наш origin (как портфолио: `/api/files/[id]/upload`), затем сервер кладёт объект в S3 — без CORS на бакет. */
    const putFileSameOrigin = (path: string, file: File, onProgress: (pct: number) => void) =>
        new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
            }
            xhr.open("PUT", path)
            xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream")
            xhr.onload = () =>
                xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Ошибка загрузки (${xhr.status})`))
            xhr.onerror = () => reject(new Error("Ошибка сети"))
            xhr.send(file)
        })

    const handleUpload = async () => {
        if (!files.length && !video) return
        setUploading(true)
        setError(null)

        const queue: File[] = [...files.map((x) => x.file)]
        if (video) queue.push(video)

        try {
            for (let i = 0; i < queue.length; i++) {
                const file = queue[i]!
                const listIdx = i < files.length ? i : -1

                const setRowProgress = (p: number) => {
                    if (listIdx >= 0) {
                        setFiles((prev) => prev.map((row, idx) => (idx === listIdx ? {
                            ...row,
                            progress: p,
                            status: "uploading"
                        } : row)))
                    }
                }

                if (listIdx >= 0) {
                    setFiles((prev) => prev.map((row, idx) => (idx === listIdx ? {
                        ...row,
                        status: "uploading",
                        progress: 0
                    } : row)))
                }

                const reg = await fetch(`/api/stages/${stageId}/upload/presign`, {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({filename: file.name, size: file.size}),
                })
                const regBody = (await reg.json().catch(() => ({}))) as { fileId?: string; error?: string }
                if (!reg.ok) {
                    throw new Error(regBody.error ?? `Не удалось подготовить загрузку (${reg.status})`)
                }
                if (!regBody.fileId) throw new Error("Нет идентификатора файла")

                await putFileSameOrigin(`/api/stages/${stageId}/files/${regBody.fileId}/upload`, file, setRowProgress)

                if (listIdx >= 0) {
                    setFiles((prev) => prev.map((row, idx) => (idx === listIdx ? {
                        ...row,
                        progress: 100,
                        status: "done"
                    } : row)))
                }
            }

            const fin = await fetch(`/api/work/stages/${stageId}/finalize-upload`, {method: "POST"})
            const finBody = (await fin.json().catch(() => ({}))) as { error?: string }
            if (!fin.ok) throw new Error(finBody.error ?? `Не удалось завершить загрузку (${fin.status})`)

            setUploaded(true)
            router.refresh()
        } catch (e) {
            setError(e instanceof Error ? e.message : "Ошибка")
            setFiles((prev) => prev.map((f) => ({...f, status: f.status === "uploading" ? "error" : f.status})))
        } finally {
            setUploading(false)
        }
    }

    const handleSubmit = async () => {
        setError(null)
        try {
            let nextStatus: string | undefined
            if (submitStage) {
                const r = await submitStage(stageId)
                if (!r.ok) throw new Error(r.error ?? "Ошибка сдачи этапа")
                nextStatus = r.status
            } else {
                const submitRes = await fetch(`/api/stages/${stageId}/submit`, {method: "POST"})
                if (!submitRes.ok) {
                    const errBody = (await submitRes.json().catch(() => ({}))) as { error?: string }
                    throw new Error(errBody.error ?? "Ошибка сдачи этапа")
                }
                const submitBody = (await submitRes.json()) as { status?: string }
                nextStatus = submitBody.status
            }
            setDoneHint(nextStatus === "CLIENT_REVIEW" ? "Отправлено заказчику" : "Отправлено на модерацию")
            setSubmitted(true)
            router.refresh()
        } catch (e) {
            setError(e instanceof Error ? e.message : "Ошибка")
        }
    }

    // Format file size
    const formatSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} Б`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`
        return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
    }

    if (submitted) {
        return (
            <div className="alert alert-success d-flex align-items-center gap-2 mb-0">
                <i className="bx bx-check-circle"/>
                {doneHint ?? "Сдано"}
            </div>
        )
    }

    return (
        <div>
            <input ref={inputRef} type="file" multiple className="d-none" onChange={handleFiles} accept={fileAccept}/>
            <input ref={videoRef} type="file" className="d-none" accept="video/mp4,.mp4" onChange={e => {
                const f = e.target.files?.[0];
                if (f) setVideo(f);
                e.target.value = ""
            }}/>

            {/* Drop zone */}
            <div
                className="border border-dashed rounded p-4 text-center mb-3"
                style={{
                    cursor: "pointer",
                    borderStyle: "dashed",
                    borderColor: dragOver ? "var(--bs-primary)" : undefined,
                    background: dragOver ? "rgba(13,110,253,0.05)" : undefined
                }}
                onClick={() => inputRef.current?.click()}
                onDragOver={e => {
                    e.preventDefault();
                    setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
            >
                <i className="bx bx-cloud-upload fs-2 text-muted d-block mb-1"/>
                <span className="text-muted">Нажмите для выбора файлов или перетащите их сюда</span>
                <div className="text-muted mt-1" style={{fontSize: "0.75rem"}}>
                    {formatsHint}
                </div>
            </div>

            {/* File list with progress */}
            {files.length > 0 && (
                <div className="mb-3" style={{maxHeight: "300px", overflowY: "auto"}}>
                    {files.map((f, i) => {
                        const isError = f.status === "error"
                        const isDone = f.status === "done"
                        const isUploading = f.status === "uploading"

                        return (
                            <div
                                key={i}
                                className="list-group-item d-flex align-items-center gap-2"
                                style={{
                                    background: isError ? "rgba(220, 53, 69, 0.1)" : "transparent",
                                    borderLeft: isError ? "3px solid #dc3545" : isDone ? "3px solid #28a745" : "3px solid transparent",
                                }}
                            >
                                <i
                                    className={`bx ${isError ? "bx-x-circle text-danger" : isDone ? "bx-check-circle text-success" : "bx-file text-muted"}`}
                                    style={{fontSize: "1.2rem"}}
                                />
                                <div className="flex-grow-1">
                                    <div className="d-flex align-items-center gap-1">
                                        <span className="text-truncate">{f.file.name}</span>
                                    </div>
                                    <div className="text-muted small">
                                        {formatSize(f.file.size)}
                                        {isUploading && f.progress > 0 && (
                                            <>
                                                {" — "}
                                                <span className="text-primary">Загружается: {f.progress}%</span>
                                            </>
                                        )}
                                        {isDone && <span className="text-success"> — Загружен</span>}
                                        {isError && <span className="text-danger"> — Ошибка</span>}
                                    </div>
                                </div>
                                <small className="text-muted">
                                    {isDone ? "✓" : isUploading ? `${f.progress}%` : ""}
                                </small>
                                <button
                                    className="btn btn-sm btn-icon btn-text-secondary"
                                    onClick={() => remove(i)}
                                    disabled={isUploading}
                                >
                                    <i className="bx bx-x"/>
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}

            {error && <div className="alert alert-danger py-2">{error}</div>}

            {/* Video explanation */}
            <div className="mb-3">
                {video ? (
                    <div className="d-flex align-items-center gap-2 p-2 rounded"
                         style={{background: "rgba(13,110,253,0.06)", border: "1px solid rgba(13,110,253,0.15)"}}>
                        <i className="bx bx-video text-primary" style={{fontSize: "1.2rem"}}/>
                        <div className="flex-grow-1">
                            <div style={{fontSize: "0.82rem", fontWeight: 500}}>{video.name}</div>
                            <div className="text-muted" style={{fontSize: "0.72rem"}}>{formatSize(video.size)} ·
                                Видео-пояснение
                            </div>
                        </div>
                        <button className="btn btn-sm btn-text-secondary" onClick={() => setVideo(null)}><i
                            className="bx bx-x"/></button>
                    </div>
                ) : (
                    <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                            onClick={() => videoRef.current?.click()}>
                        <i className="bx bx-video"/>
                        Прикрепить видео-пояснение (MP4, до 500 МБ)
                    </button>
                )}
            </div>

            {(files.length > 0 || video) && !uploaded && (
                <button
                    className="btn btn-primary"
                    onClick={handleUpload}
                    disabled={uploading || files.some((f) => f.status === "uploading")}
                >
                    <i className={`bx ${uploading ? "bx-loader-alt" : "bx-cloud-upload"} me-1`}/>
                    {uploading
                        ? "Загрузка..."
                        : files.length > 0
                            ? `Загрузить (${files.length} файл${files.length > 1 ? "а" : ""})`
                            : "Загрузить видео"}
                </button>
            )}

            {uploaded && !submitted && (
                <div className="d-flex gap-2 align-items-center">
                    <span className="text-success"><i className="bx bx-check-circle me-1"/>Файлы загружены</span>
                    <button className="btn btn-primary" onClick={handleSubmit}>
                        <i className="bx bx-send me-1"/>
                        Сдать на проверку
                    </button>
                </div>
            )}
        </div>
    )
}
