import React, { useEffect, useMemo, useRef, useState } from "react"
import { ImageAnnotator, ImageAnnotationPopup, UserSelectAction, W3CImageFormat } from "@annotorious/react"

import type { ImageAnnotation, PopupProps } from "@annotorious/react"

import type { MarkupToastVariant } from "./types"
import { AnnotationSync } from "./AnnotationSync"
import { CommentPopup } from "./CommentPopup"
import { SaveAnnotationsBar } from "./SaveAnnotationsBar"

export function MarkupCanvas({
  stageId,
  fileId,
  filename,
  editable,
  imageUrl,
  showToast,
}: {
  stageId: string
  fileId: string
  filename: string
  editable: boolean
  imageUrl: string
  showToast: (message: string, variant: MarkupToastVariant) => void
}) {
  const [imageLoadError, setImageLoadError] = useState<string | null>(null)
  const adapter = useMemo(() => W3CImageFormat(imageUrl), [imageUrl])
  const lastSavedJsonRef = useRef<string | null>(null)
  /** Annotorious responsive слой делит на размер viewBox; до загрузки картинки там 0×0 → Infinity/NaN в SVG. */
  const [imageReady, setImageReady] = useState(false)
  /** Доп. гейт: пока <img> внутри annotator не загрузилась, у Annotorious могут быть NaN/Infinity в SVG. */
  const [annotatorImgReady, setAnnotatorImgReady] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [debugEnabled, setDebugEnabled] = useState(false)

  useEffect(() => {
    setImageReady(false)
    setAnnotatorImgReady(false)
    setImageLoadError(null)
    setReloadKey((k) => k + 1)
  }, [imageUrl])

  // Fail-safe: если картинка слишком долго грузится — покажем понятное сообщение и ссылку.
  useEffect(() => {
    const t = setTimeout(() => {
      setImageLoadError("Загрузка изображения занимает слишком много времени. Попробуйте открыть файл отдельно.")
    }, 25000)
    return () => {
      clearTimeout(t)
    }
  }, [imageUrl])

  useEffect(() => {
    try {
      // включается вручную в DevTools: localStorage.setItem("markupDebug","1")
      setDebugEnabled(window.localStorage.getItem("markupDebug") === "1")
    } catch {
      setDebugEnabled(false)
    }
  }, [])

  const imgStyle = { maxWidth: "100%" as const, height: "auto" as const, display: "block" as const }
  const [annoState, setAnnoState] = useState<{
    fetchState: "idle" | "loading" | "ok" | "error"
    fetchedCount?: number
    appliedCount?: number
    lastError?: string
  }>({ fetchState: "idle" })

  return (
    <>
      {debugEnabled ? (
        <div style={{ margin: "6px 0 10px", fontSize: "0.72rem", color: "var(--dash-muted)" }}>
          <span style={{ fontWeight: 700, color: "var(--dash-text2)" }}>Разметка:</span>{" "}
          {editable ? (
            <span style={{ color: "var(--dash-success)" }}>редактирование включено</span>
          ) : (
            <span style={{ color: "var(--dash-warn)" }}>только просмотр (editable=false)</span>
          )}
          {" · "}
          <span>
            аннотации:{" "}
            {annoState.fetchState === "loading"
              ? "загрузка…"
              : annoState.fetchState === "error"
                ? `ошибка (${annoState.lastError ?? "unknown"})`
                : "ок"}
          </span>
          {" · "}
          <span>получено: {annoState.fetchedCount ?? "—"}</span>
          {" · "}
          <span>применено: {annoState.appliedCount ?? "—"}</span>
        </div>
      ) : null}

      {!imageReady ? (
        <div
          aria-busy="true"
          aria-label="Загрузка изображения для разметки"
          style={{
            position: "relative",
            width: "100%",
            maxWidth: "100%",
            overflow: "hidden",
            borderRadius: 8,
            // Не блокируем клики полностью — иначе нельзя нажать «Открыть файл».
            pointerEvents: "auto",
            userSelect: "none",
          }}
        >
          <img
            key={`${imageUrl}:${reloadKey}`}
            src={imageUrl}
            alt=""
            aria-hidden
            decoding="async"
            loading="eager"
            draggable={false}
            style={{
              ...imgStyle,
              filter: "blur(14px)",
              transform: "scale(1.08)",
              transformOrigin: "center center",
            }}
            onLoad={() => {
              if (debugEnabled) console.log("[markup] image loaded", { imageUrl })
              setImageReady(true)
            }}
            onError={() => {
              if (debugEnabled) console.log("[markup] image failed", { imageUrl })
              setImageLoadError("Не удалось загрузить изображение. Проверьте сеть и доступ.")
              setImageReady(true)
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: 20,
              textAlign: "center",
              background: "rgba(15, 23, 42, 0.42)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              // Слой поверх картинки: клики по ссылке/кнопке должны работать.
              pointerEvents: "auto",
            }}
          >
            <span
              style={{
                fontSize: "0.88rem",
                fontWeight: 600,
                color: "rgba(255, 255, 255, 0.95)",
                letterSpacing: "0.02em",
                textShadow: "0 1px 12px rgba(0,0,0,0.45)",
                animation: "markup-loading-pulse 1.6s ease-in-out infinite",
              }}
            >
              Загрузка разметки…
            </span>
            <span
              style={{
                fontSize: "0.72rem",
                lineHeight: 1.45,
                color: "rgba(255, 255, 255, 0.72)",
                maxWidth: 280,
                textShadow: "0 1px 8px rgba(0,0,0,0.35)",
              }}
            >
              Подождите: крупные изображения могут загружаться дольше. До завершения пометки недоступны.
            </span>
            {imageLoadError ? (
              <div style={{ marginTop: 10, fontSize: "0.72rem", color: "rgba(255,255,255,0.85)", lineHeight: 1.45 }}>
                {imageLoadError}{" "}
                <a
                  href={imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "rgba(96,165,250,0.95)", textDecoration: "underline" }}
                >
                  Открыть файл →
                </a>
                <div style={{ marginTop: 10, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (debugEnabled) console.log("[markup] retry image", { imageUrl })
                      setImageLoadError(null)
                      setImageReady(false)
                      setReloadKey((k) => k + 1)
                    }}
                    style={{
                      pointerEvents: "auto",
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.18)",
                      background: "rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.9)",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Повторить загрузку
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Позволяем пройти дальше, чтобы увидеть хотя бы UI разметки/статусы,
                      // даже если загрузка медленная (реальная ошибка будет видна на картинке).
                      if (debugEnabled) console.log("[markup] force show annotator", { imageUrl })
                      setImageReady(true)
                    }}
                    style={{
                      pointerEvents: "auto",
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid rgba(96,165,250,0.45)",
                      background: "rgba(96,165,250,0.12)",
                      color: "rgba(255,255,255,0.9)",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Показать разметку
                  </button>
                </div>
                {debugEnabled ? (
                  <div style={{ marginTop: 10, fontSize: "0.65rem", opacity: 0.85, wordBreak: "break-word" }}>
                    debug: imageReady={String(imageReady)} reloadKey={reloadKey} url={imageUrl}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div style={{ position: "relative", width: "100%", maxWidth: "100%" }}>
          {!annotatorImgReady ? (
            <img
              key={`${imageUrl}:${reloadKey}:preload`}
              src={imageUrl}
              alt={filename}
              decoding="async"
              style={imgStyle}
              onLoad={() => setAnnotatorImgReady(true)}
              onError={() => {
                if (debugEnabled) console.log("[markup] annotator preload img failed", { imageUrl })
                showToast("Не удалось загрузить изображение для разметки", "error")
                setAnnotatorImgReady(false)
              }}
            />
          ) : (
            <ImageAnnotator
              // remount after preload to avoid 0×0 responsive viewBox
              key={`${imageUrl}:${reloadKey}:annotator-mounted`}
              adapter={adapter}
              drawingEnabled={editable}
              userSelectAction={UserSelectAction.EDIT}
            >
              <img
                src={imageUrl}
                alt={filename}
                decoding="async"
                style={imgStyle}
                onError={() => {
                  if (debugEnabled) console.log("[markup] annotator img failed", { imageUrl })
                  showToast("Не удалось загрузить изображение для разметки", "error")
                }}
              />
            </ImageAnnotator>
          )}
        </div>
      )}

      <AnnotationSync
        stageId={stageId}
        fileId={fileId}
        editable={editable}
        showToast={showToast}
        lastSavedJsonRef={lastSavedJsonRef}
        onStatus={(s) =>
          setAnnoState((prev) => ({
            ...prev,
            ...s,
          }))
        }
      />

      <ImageAnnotationPopup
        popup={(p: PopupProps<ImageAnnotation>) => (
          <CommentPopup
            key={p.annotation.id}
            annotation={p.annotation}
            event={p.event}
            onCreateBody={p.onCreateBody}
            onDeleteBody={p.onDeleteBody}
            onUpdateBody={p.onUpdateBody}
            selectionEditable={p.editable !== false}
            allowMarkupEdit={editable}
            showToast={showToast}
          />
        )}
      />

      <SaveAnnotationsBar
        editable={editable}
        stageId={stageId}
        fileId={fileId}
        showToast={showToast}
        lastSavedJsonRef={lastSavedJsonRef}
      />
    </>
  )
}

