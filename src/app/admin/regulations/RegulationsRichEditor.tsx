"use client"

import type {ReactNode} from "react"
import {EditorContent, useEditor, useEditorState} from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import {Markdown} from "@tiptap/markdown"
import {TableKit} from "@tiptap/extension-table"
import styles from "./regulations-rich-editor.module.css"
import {promptDialog} from "@/lib/dialog-store"

// Вне компонента: новые экземпляры на каждом рендере заставляли бы useEditor вызывать setOptions при каждом нажатии.
const EXTENSIONS = [
    StarterKit.configure({
        heading: {levels: [2, 3]},
        underline: false,
        link: {openOnClick: false, autolink: true, defaultProtocol: "https"},
    }),
    TableKit,
    Markdown,
]

const EDITOR_PROPS = {attributes: {class: styles.content}}

type Props = {
    /** Исходный markdown — редактор читает его один раз при создании. */
    initialMarkdown: string
    /** Markdown после разбора редактором: нормализованный текст служит точкой отсчёта для «есть изменения». */
    onReady: (markdown: string) => void
    onChange: (markdown: string) => void
}

/**
 * WYSIWYG-редактор регламента. Текст по-прежнему хранится в markdown (его рендерит онбординг специалиста),
 * поэтому набор форматирования ограничен тем, что переживает markdown: подчёркивание отключено.
 */
export function RegulationsRichEditor({initialMarkdown, onReady, onChange}: Props) {
    const editor = useEditor({
        extensions: EXTENSIONS,
        content: initialMarkdown,
        contentType: "markdown",
        immediatelyRender: false,
        editorProps: EDITOR_PROPS,
        onCreate: ({editor}) => onReady(editor.getMarkdown()),
        onUpdate: ({editor}) => onChange(editor.getMarkdown()),
    })

    // Берём editor из замыкания, а не из снимка: снимок useEditorState получает созданный редактор
    // только после первой транзакции, и до неё панель (и сам текст) не показались бы вовсе.
    const state = useEditorState({
        editor,
        selector: () => editor ? {
            h2: editor.isActive("heading", {level: 2}),
            h3: editor.isActive("heading", {level: 3}),
            bold: editor.isActive("bold"),
            italic: editor.isActive("italic"),
            strike: editor.isActive("strike"),
            bulletList: editor.isActive("bulletList"),
            orderedList: editor.isActive("orderedList"),
            blockquote: editor.isActive("blockquote"),
            link: editor.isActive("link"),
            canUndo: editor.can().undo(),
            canRedo: editor.can().redo(),
        } : null,
    })

    if (!editor) {
        return <div className={styles.frame}><div className={`${styles.content} ${styles.placeholder}`}/></div>
    }

    const chain = () => editor.chain().focus()

    const editLink = async () => {
        const prev = editor.getAttributes("link").href as string | undefined
        const href = await promptDialog({title: "Адрес ссылки (пусто — убрать ссылку)", defaultValue: prev ?? "https://"})
        if (href === null) return
        if (!href.trim()) {
            chain().extendMarkRange("link").unsetLink().run()
            return
        }
        chain().extendMarkRange("link").setLink({href: href.trim()}).run()
    }

    return (
        <div className={styles.frame}>
            <div className={styles.toolbar} role="toolbar" aria-label="Форматирование">
                <ToolButton label="Отменить" icon="bx-undo" disabled={!state?.canUndo}
                            onClick={() => chain().undo().run()}/>
                <ToolButton label="Повторить" icon="bx-redo" disabled={!state?.canRedo}
                            onClick={() => chain().redo().run()}/>
                <span className={styles.divider}/>
                <ToolButton label="Заголовок" active={state?.h2}
                            onClick={() => chain().toggleHeading({level: 2}).run()}>H2</ToolButton>
                <ToolButton label="Подзаголовок" active={state?.h3}
                            onClick={() => chain().toggleHeading({level: 3}).run()}>H3</ToolButton>
                <span className={styles.divider}/>
                <ToolButton label="Жирный" icon="bx-bold" active={state?.bold}
                            onClick={() => chain().toggleBold().run()}/>
                <ToolButton label="Курсив" icon="bx-italic" active={state?.italic}
                            onClick={() => chain().toggleItalic().run()}/>
                <ToolButton label="Зачёркнутый" icon="bx-strikethrough" active={state?.strike}
                            onClick={() => chain().toggleStrike().run()}/>
                <ToolButton label="Ссылка" icon="bx-link" active={state?.link} onClick={editLink}/>
                <span className={styles.divider}/>
                <ToolButton label="Маркированный список" icon="bx-list-ul" active={state?.bulletList}
                            onClick={() => chain().toggleBulletList().run()}/>
                <ToolButton label="Нумерованный список" icon="bx-list-ol" active={state?.orderedList}
                            onClick={() => chain().toggleOrderedList().run()}/>
                <ToolButton label="Цитата" icon="bxs-quote-alt-left" active={state?.blockquote}
                            onClick={() => chain().toggleBlockquote().run()}/>
                <ToolButton label="Разделитель" icon="bx-minus"
                            onClick={() => chain().setHorizontalRule().run()}/>
            </div>
            <EditorContent editor={editor}/>
        </div>
    )
}

function ToolButton({label, icon, active, disabled, onClick, children}: {
    label: string
    icon?: string
    active?: boolean
    disabled?: boolean
    onClick: () => void
    children?: ReactNode
}) {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            disabled={disabled}
            className={`${styles.tool} ${active ? styles.toolActive : ""}`}
            // Не уводим фокус из редактора, иначе команда применится к потерянному выделению.
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
        >
            {icon ? <i className={`bx ${icon}`}/> : children}
        </button>
    )
}
