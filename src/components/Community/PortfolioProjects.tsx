"use client"

import {type ReactNode, useEffect, useMemo, useState} from "react"
import {ActionButton} from "@/components/app/AppCard"
import {PortfolioCardBrowseModal} from "./PortfolioCardBrowseModal"
import {type CardFile, type PortfolioCard, PortfolioCardEditorModal} from "./PortfolioCardEditorModal"
import {PortfolioProjectMaterials} from "./PortfolioProjectMaterials"
import {PortfolioRemoteFilePreview} from "./PortfolioMediaPreview"

const cardShell: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(20,25,40,0.22)",
    boxShadow: "none",
}

const hintMuted: React.CSSProperties = {
    fontSize: 12,
    lineHeight: 1.55,
    color: "rgba(255,255,255,0.62)",
}

function HintPanel({title, children}: { title: string; children: ReactNode }) {
    return (
        <div
            style={{
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
                background: "rgba(12,16,30,0.35)",
                padding: "10px 12px",
            }}
        >
            <div className="d-flex align-items-center gap-2 mb-2">
                <i className="bx bx-info-circle" style={{fontSize: 16, color: "rgba(115,103,240,0.95)"}}/>
                <span className="fw-semibold" style={{fontSize: 12, color: "var(--dash-text, #f4f4f4)"}}>
          {title}
        </span>
            </div>
            <div style={hintMuted}>{children}</div>
        </div>
    )
}

interface Project {
    id: string
    name: string
    createdAt: string
    _count: { cards: number }
}

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
    const res = await fetch(input, init)
    const text = await res.text()
    let body: { error?: string } | unknown = {}
    if (text) {
        try {
            body = JSON.parse(text) as { error?: string }
        } catch {
            throw new Error(text.slice(0, 200) || `Ошибка сервера (${res.status})`)
        }
    }
    if (!res.ok) {
        const message =
            typeof (body as { error?: string })?.error === "string"
                ? (body as { error: string }).error
                : `Запрос не выполнен (${res.status})`
        throw new Error(message)
    }
    return body as T
}

function isImageFile(f: Pick<CardFile, "mimeType" | "filename">) {
    return f.mimeType?.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(f.filename)
}

function getCardCover(card: PortfolioCard): CardFile | null {
    if (card.mainFile) return card.mainFile
    const att = card.attachments.find((a) => isImageFile(a.file))
    return att?.file ?? null
}

function formatWorksCountLabel(n: number): string {
    if (n === 0) return "нет работ"
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod10 === 1 && mod100 !== 11) return `${n} работа`
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} работы`
    return `${n} работ`
}

export default function PortfolioProjects() {
    const [projects, setProjects] = useState<Project[]>([])
    const [loadingProjects, setLoadingProjects] = useState(false)
    const [projectsError, setProjectsError] = useState<string | null>(null)
    const [newProjectName, setNewProjectName] = useState("")

    const [selectedProject, setSelectedProject] = useState<Project | null>(null)
    const [cards, setCards] = useState<PortfolioCard[]>([])
    const [loadingCards, setLoadingCards] = useState(false)
    const [cardsError, setCardsError] = useState<string | null>(null)

    const [createModalOpen, setCreateModalOpen] = useState(false)
    const [editingCard, setEditingCard] = useState<PortfolioCard | null>(null)
    const [browseCard, setBrowseCard] = useState<PortfolioCard | null>(null)

    const loadProjects = async () => {
        setLoadingProjects(true)
        setProjectsError(null)
        try {
            const data = await fetchJson<Project[]>("/api/portfolio/projects")
            setProjects(data)
        } catch (error) {
            setProjectsError((error as Error).message)
        } finally {
            setLoadingProjects(false)
        }
    }

    const loadCards = async (project: Project) => {
        setLoadingCards(true)
        setCardsError(null)
        try {
            const data = await fetchJson<PortfolioCard[]>(`/api/portfolio/projects/${project.id}/cards`)
            setCards(data)
        } catch (error) {
            setCardsError((error as Error).message)
        } finally {
            setLoadingCards(false)
        }
    }

    useEffect(() => {
        void loadProjects()
    }, [])

    const createProject = async () => {
        const name = newProjectName.trim()
        if (!name) return
        try {
            const project = await fetchJson<Project>("/api/portfolio/projects", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({name}),
            })
            setProjects((prev) => [project, ...prev])
            setNewProjectName("")
            setProjectsError(null)
        } catch (error) {
            setProjectsError((error as Error).message)
        }
    }

    const openProject = async (project: Project) => {
        setSelectedProject(project)
        setEditingCard(null)
        setCreateModalOpen(false)
        setBrowseCard(null)
        await loadCards(project)
    }

    const goToProjectsRoot = () => {
        setEditingCard(null)
        setCreateModalOpen(false)
        setBrowseCard(null)
        setSelectedProject(null)
    }

    const goToProjectOnly = () => {
        setEditingCard(null)
        setCreateModalOpen(false)
        setBrowseCard(null)
    }

    const refreshCards = async () => {
        if (selectedProject) await loadCards(selectedProject)
    }

    const pageTitle = !selectedProject ? "Проекты" : "Работы"
    const pageSubtitle = useMemo(() => {
        if (!selectedProject) return "Папки в виде вертикальных плиток (как работы). Внутри проекта — такая же сетка работ и общие материалы папки."
        return `Проект «${selectedProject.name}». Плитки — работы (файлы к конкретной работе — в окне «Изменить» / при создании). Ниже плиток — материалы проекта: один раз на всю папку, не к одной работе.`
    }, [selectedProject])

    const editorOpen = createModalOpen || !!editingCard
    const editorMode = editingCard ? "edit" : "create"

    return (
        <>
            <div className="dash-col1">
                {!selectedProject ? (
                    <div className="card" style={cardShell}>
                        <div className="card-body d-flex flex-column gap-3" style={{padding: 12}}>
                            <div
                                style={{
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: 10,
                                    background: "rgba(12,16,30,0.45)",
                                    padding: 10,
                                }}
                            >
                                <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                  <span className="fw-semibold" style={{fontSize: 13, color: "var(--dash-text, #f4f4f4)"}}>
                    Новый проект
                  </span>
                                </div>
                                <p className="mb-2 small text-muted" style={{lineHeight: 1.45}}>
                                    Название папки, затем «Добавить проект».
                                </p>
                                <div className="d-flex flex-column gap-2">
                                    <input
                                        className="form-control form-control-sm"
                                        placeholder="Например: Квартира Сокольники"
                                        value={newProjectName}
                                        onChange={(e) => setNewProjectName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") void createProject()
                                        }}
                                        aria-label="Название нового проекта"
                                        style={{
                                            minHeight: 32,
                                            background: "rgba(255,255,255,0.03)",
                                            borderColor: "rgba(255,255,255,0.14)",
                                            color: "var(--dash-text, #f4f4f4)",
                                        }}
                                    />
                                    <ActionButton
                                        type="button"
                                        variant="primary"
                                        icon="bx-folder-plus"
                                        className="btn-sm"
                                        onClick={() => void createProject()}
                                        style={{minHeight: 32}}
                                    >
                                        Добавить проект
                                    </ActionButton>
                                </div>
                            </div>
                            {projectsError && <small className="text-danger">{projectsError}</small>}

                            <HintPanel title="Как пользоваться">
                                <ol className="mb-0 ps-3" style={{marginTop: 6}}>
                                    <li className="mb-1">Создайте проект слева, затем нажмите его плитку в сетке
                                        справа.
                                    </li>
                                    <li className="mb-1">
                                        <strong>К работе</strong> — плитки «Новая работа» / существующие работы: в окне
                                        работы — название, главное фото, при желании файлы
                                        только к этой работе (к кадру, галерее или отдельной сетке по работе).
                                    </li>
                                    <li className="mb-0">
                                        <strong>К проекту целиком</strong> — блок «Материалы проекта» под плитками на
                                        большой панели: общие PDF, спецификации и т.д. на всю
                                        папку; работы при этом можно оставить только с фото и рендерами.
                                    </li>
                                </ol>
                            </HintPanel>
                        </div>
                    </div>
                ) : (
                    <div className="card" style={cardShell}>
                        <div className="card-body d-flex flex-column gap-3" style={{padding: 12}}>
                            <div>
                                <div className="text-muted mb-1" style={{fontSize: 11}}>
                                    Проект
                                </div>
                                <span className="fw-semibold text-truncate d-block"
                                      style={{fontSize: 14, color: "var(--dash-text, #f4f4f4)"}}>
                  {selectedProject.name}
                </span>
                            </div>
                            <ActionButton type="button" icon="bx-chevrons-left" className="btn-sm btn-outline-secondary"
                                          onClick={goToProjectsRoot}>
                                Все проекты
                            </ActionButton>

                            <HintPanel title="Работы и материалы">
                                <ul className="mb-0 ps-3" style={{marginTop: 6}}>
                                    <li className="mb-2">
                                        <strong>Плитки</strong> — это работы. Просмотр по клику; «Изменить» — вложения и
                                        фото <em>только у этой работы</em>.
                                    </li>
                                    <li className="mb-0">
                                        <strong>Ниже плиток</strong> (на широкой колонке) — «Материалы проекта»:
                                        файлы <em>на всю папку</em>, не привязанные к одной работе.
                                    </li>
                                </ul>
                            </HintPanel>
                        </div>
                    </div>
                )}
            </div>

            <div className="dash-col2" id="portfolio-uploader">
                <div className="card" style={cardShell}>
                    <div className="card-body d-flex flex-column gap-3" style={{padding: 14}}>
                        <nav aria-label="Навигация по портфолио"
                             className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                            <div className="d-flex flex-wrap align-items-center gap-1 small">
                                <button
                                    type="button"
                                    className={`btn btn-link btn-sm p-0 text-decoration-none ${!selectedProject ? "fw-semibold text-body" : "text-muted"}`}
                                    onClick={goToProjectsRoot}
                                    style={{color: !selectedProject ? "var(--dash-text, #f4f4f4)" : undefined}}
                                >
                                    Портфолио
                                </button>
                                {selectedProject && (
                                    <>
                                        <span className="text-muted user-select-none">/</span>
                                        <button
                                            type="button"
                                            className={`btn btn-link btn-sm p-0 text-decoration-none text-truncate ${editingCard ? "text-muted" : "fw-semibold text-body"}`}
                                            onClick={goToProjectOnly}
                                            style={{
                                                maxWidth: "min(280px, 46vw)",
                                                color: !editingCard ? "var(--dash-text, #f4f4f4)" : undefined
                                            }}
                                            title={selectedProject.name}
                                        >
                                            {selectedProject.name}
                                        </button>
                                    </>
                                )}
                                {editingCard && (
                                    <>
                                        <span className="text-muted user-select-none">/</span>
                                        <span className="small text-truncate fw-semibold"
                                              style={{maxWidth: "min(200px, 40vw)"}} title={editingCard.title}>
                      {editingCard.title}
                    </span>
                                    </>
                                )}
                            </div>
                            {selectedProject && (
                                <ActionButton type="button"
                                              className="btn-sm btn-outline-secondary d-none d-md-inline-flex"
                                              onClick={goToProjectsRoot}>
                                    Все проекты
                                </ActionButton>
                            )}
                        </nav>

                        <div>
                            <h6 className="mb-1 fw-semibold" style={{fontSize: 15, color: "var(--dash-text, #f4f4f4)"}}>
                                {pageTitle}
                            </h6>
                            <p className="mb-0 small text-muted" style={{lineHeight: 1.45}}>
                                {pageSubtitle}
                            </p>
                        </div>

                        <style>{`
              .pf-port-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
                gap: 12px;
              }
              .pf-port-grid__cell {
                aspect-ratio: 2 / 3;
                border-radius: 14px;
                overflow: hidden;
                position: relative;
                border: 1px solid rgba(255,255,255,0.12);
                background: rgba(12,16,30,0.45);
              }
              .pf-port-grid__add {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 6px;
                width: 100%;
                height: 100%;
                padding: 10px 8px;
                border: 2px dashed rgba(115,103,240,0.4);
                background: rgba(115,103,240,0.08);
                color: #c9c6ff;
                cursor: pointer;
                text-align: center;
                font: inherit;
                transition: background 0.15s, border-color 0.15s;
              }
              .pf-port-grid__add:hover {
                background: rgba(115,103,240,0.14);
                border-color: rgba(115,103,240,0.65);
              }
              .pf-port-grid__add i { font-size: 1.75rem; opacity: 0.9; }
              .pf-port-grid__add-title { font-size: 0.78rem; font-weight: 600; color: var(--dash-text, #f4f4f4); }
              .pf-port-grid__card { cursor: pointer; }
              .pf-port-grid__cover { position: absolute; inset: 0; }
              .pf-port-grid__shade {
                position: absolute; inset: 0;
                background: linear-gradient(to top, rgba(6,8,16,0.92) 0%, rgba(6,8,16,0.2) 42%, transparent 55%);
                pointer-events: none;
              }
              .pf-port-grid__title {
                position: absolute; left: 8px; right: 8px; bottom: 44px;
                font-size: 0.72rem; font-weight: 600; color: #f4f6ff;
                text-shadow: 0 1px 6px rgba(0,0,0,0.75);
                display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
                overflow: hidden; line-height: 1.25;
                pointer-events: none;
              }
              .pf-port-grid__foot {
                position: absolute; left: 0; right: 0; bottom: 0; padding: 6px 8px 8px;
                display: flex; justify-content: flex-end; align-items: center;
                pointer-events: none;
              }
              .pf-port-grid__foot > button { pointer-events: auto; }
            `}</style>

                        {!selectedProject ? (
                            <>
                                {loadingProjects ? (
                                    <div className="text-muted small d-flex align-items-center gap-2">
                                        <i className="bx bx-loader-alt bx-spin" aria-hidden/>
                                        Загрузка…
                                    </div>
                                ) : projects.length === 0 ? (
                                    <div
                                        className="rounded-2 p-3 text-center"
                                        style={{
                                            border: "1px dashed rgba(255,255,255,0.15)",
                                            background: "rgba(12,16,30,0.25)"
                                        }}
                                    >
                                        <i className="bx bx-folder-plus d-block mb-2"
                                           style={{fontSize: 28, opacity: 0.65}} aria-hidden/>
                                        <p className="small text-muted mb-0" style={{lineHeight: 1.55}}>
                                            Проектов нет. Создайте папку слева кнопкой <strong>«Добавить
                                            проект»</strong>, затем откройте её здесь.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <p className="small text-muted mb-2">
                                            Плитки в том же формате, что и работы. Нажмите плитку проекта — откроется
                                            сетка работ. Число справа внизу — сколько работ в
                                            папке.
                                        </p>
                                        <div className="pf-port-grid">
                                            {projects.map((project) => {
                                                const worksLabel = formatWorksCountLabel(project._count.cards)
                                                return (
                                                    <div
                                                        key={project.id}
                                                        role="button"
                                                        tabIndex={0}
                                                        className="pf-port-grid__cell pf-port-grid__card"
                                                        onClick={() => void openProject(project)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter" || e.key === " ") {
                                                                e.preventDefault()
                                                                void openProject(project)
                                                            }
                                                        }}
                                                    >
                                                        <div className="pf-port-grid__cover">
                                                            <div
                                                                className="d-flex h-100 w-100 align-items-center justify-content-center"
                                                                style={{
                                                                    background:
                                                                        "linear-gradient(165deg, rgba(91,79,207,0.18) 0%, rgba(12,16,30,0.94) 55%, rgba(8,10,18,0.98) 100%)",
                                                                }}
                                                            >
                                                                <i className="bx bx-folder" style={{
                                                                    fontSize: 52,
                                                                    opacity: 0.38,
                                                                    color: "#b4bce8"
                                                                }} aria-hidden/>
                                                            </div>
                                                        </div>
                                                        <div className="pf-port-grid__shade" aria-hidden/>
                                                        <div className="pf-port-grid__title">{project.name}</div>
                                                        <div className="pf-port-grid__foot">
                              <span className="badge bg-label-secondary" style={{fontSize: "0.65rem", fontWeight: 600}}>
                                {worksLabel}
                              </span>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </>
                                )}
                            </>
                        ) : (
                            <>
                                <p className="small text-muted mb-2" style={{lineHeight: 1.45}}>
                                    <strong>Сверху</strong> — работы: первая плитка «Новая работа», остальные —
                                    просмотр; файлы к конкретной работе — в её окне.{" "}
                                    <strong>Снизу</strong> — «Материалы проекта»: общие вложения на всю папку (отдельно
                                    от работ).
                                </p>
                                {cardsError && <small className="text-danger">{cardsError}</small>}
                                {loadingCards ? (
                                    <div className="text-muted small d-flex align-items-center gap-2">
                                        <i className="bx bx-loader-alt bx-spin" aria-hidden/>
                                        Загрузка работ…
                                    </div>
                                ) : (
                                    <>
                                        <div className="pf-port-grid">
                                            <div className="pf-port-grid__cell">
                                                <button
                                                    type="button"
                                                    className="pf-port-grid__add"
                                                    onClick={() => {
                                                        setEditingCard(null)
                                                        setCreateModalOpen(true)
                                                    }}
                                                >
                                                    <i className="bx bx-plus" aria-hidden/>
                                                    <span className="pf-port-grid__add-title">Новая работа</span>
                                                </button>
                                            </div>
                                            {cards.map((card) => {
                                                const cover = getCardCover(card)
                                                return (
                                                    <div
                                                        key={card.id}
                                                        role="button"
                                                        tabIndex={0}
                                                        className="pf-port-grid__cell pf-port-grid__card"
                                                        onClick={() => {
                                                            setCreateModalOpen(false)
                                                            setBrowseCard(card)
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter" || e.key === " ") {
                                                                e.preventDefault()
                                                                setCreateModalOpen(false)
                                                                setBrowseCard(card)
                                                            }
                                                        }}
                                                    >
                                                        <div className="pf-port-grid__cover">
                                                            {cover ? (
                                                                <PortfolioRemoteFilePreview
                                                                    fileId={cover.id}
                                                                    mimeType={cover.mimeType}
                                                                    filename={cover.filename}
                                                                    rounded={0}
                                                                    fillParent
                                                                />
                                                            ) : (
                                                                <div
                                                                    className="d-flex align-items-center justify-content-center h-100 w-100 text-muted">
                                                                    <i className="bx bx-image"
                                                                       style={{fontSize: 32, opacity: 0.35}}
                                                                       aria-hidden/>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="pf-port-grid__shade" aria-hidden/>
                                                        <div className="pf-port-grid__title">{card.title}</div>
                                                        <div className="pf-port-grid__foot">
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-light"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    setBrowseCard(null)
                                                                    setCreateModalOpen(false)
                                                                    setEditingCard(card)
                                                                }}
                                                            >
                                                                Изменить
                                                            </button>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                        <PortfolioProjectMaterials projectId={selectedProject.id}/>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {selectedProject && (
                    <>
                        {browseCard && (
                            <PortfolioCardBrowseModal
                                key={browseCard.id}
                                card={browseCard}
                                onClose={() => setBrowseCard(null)}
                                onEdit={() => {
                                    setEditingCard(browseCard)
                                    setBrowseCard(null)
                                }}
                            />
                        )}
                        <PortfolioCardEditorModal
                            mode={editorMode}
                            open={editorOpen}
                            projectId={selectedProject.id}
                            card={editingCard}
                            onClose={() => {
                                setCreateModalOpen(false)
                                setEditingCard(null)
                            }}
                            onSuccess={() => {
                                void refreshCards()
                                if (editorMode === "create" && selectedProject) {
                                    setProjects((prev) =>
                                        prev.map((p) =>
                                            p.id === selectedProject.id ? {
                                                ...p,
                                                _count: {cards: p._count.cards + 1}
                                            } : p,
                                        ),
                                    )
                                }
                            }}
                        />
                    </>
                )}
            </div>
        </>
    )
}
