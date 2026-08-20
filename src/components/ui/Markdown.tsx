"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

/**
 * Рендер markdown-текста (регламент, редактируемые админом материалы).
 * Цвета берутся из currentColor/CSS-переменных — компонент подстраивается под тёмный
 * онбординг и под светлую админку без дополнительных пропсов.
 */
export function Markdown({content, className}: { content: string; className?: string }) {
    return (
        <div className={`md-body${className ? ` ${className}` : ""}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            <style>{MARKDOWN_STYLES}</style>
        </div>
    )
}

const MARKDOWN_STYLES = `
.md-body {
    font-size: 0.88rem;
    line-height: 1.65;
    overflow-wrap: anywhere;
}
.md-body > :first-child { margin-top: 0; }
.md-body > :last-child { margin-bottom: 0; }
.md-body h1, .md-body h2, .md-body h3, .md-body h4 {
    font-weight: 600;
    line-height: 1.3;
    margin: 1.4em 0 0.5em;
}
.md-body h1 { font-size: 1.25rem; }
.md-body h2 { font-size: 1.08rem; }
.md-body h3 { font-size: 0.98rem; }
.md-body h4 { font-size: 0.9rem; }
.md-body p { margin: 0 0 0.85em; }
.md-body ul, .md-body ol { margin: 0 0 0.85em; padding-left: 1.35em; }
.md-body li { margin-bottom: 0.3em; }
.md-body a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
.md-body blockquote {
    margin: 0 0 0.85em;
    padding: 0.2em 0 0.2em 0.9em;
    border-left: 2px solid rgba(127, 127, 127, 0.45);
    opacity: 0.85;
}
.md-body code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.85em;
    padding: 0.1em 0.35em;
    border-radius: 4px;
    background: rgba(127, 127, 127, 0.18);
}
.md-body pre {
    margin: 0 0 0.85em;
    padding: 0.8em 1em;
    border-radius: 8px;
    overflow-x: auto;
    background: rgba(127, 127, 127, 0.15);
}
.md-body pre code { background: none; padding: 0; }
.md-body hr {
    margin: 1.4em 0;
    border: none;
    border-top: 1px solid rgba(127, 127, 127, 0.35);
}
.md-body table {
    width: 100%;
    margin: 0 0 0.85em;
    border-collapse: collapse;
    font-size: 0.85em;
    display: block;
    overflow-x: auto;
}
.md-body th, .md-body td {
    padding: 0.45em 0.7em;
    border: 1px solid rgba(127, 127, 127, 0.35);
    text-align: left;
}
.md-body th { font-weight: 600; }
.md-body img { max-width: 100%; height: auto; border-radius: 8px; }
`
