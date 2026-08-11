/**
 * AdminTable — обёртка над shadcn Table, стилизованная под админскую тему (--adm-* переменные).
 * Используйте вместо голого Table внутри AdminLayout.
 */
import {Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow,} from "@/components/ui/table"

const wrapperStyle: React.CSSProperties = {
    background: "var(--adm-sidebar)",
    border: "1px solid var(--adm-sidebar-border)",
    borderRadius: 8,
    overflow: "auto",
}

const headStyle: React.CSSProperties = {
    background: "var(--adm-outer, var(--adm-sidebar))",
    borderBottom: "1px solid var(--adm-sidebar-border)",
}

const thStyle: React.CSSProperties = {
    color: "var(--adm-muted)",
    fontSize: "0.68rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    padding: "10px 14px",
    whiteSpace: "nowrap",
}

const tdStyle: React.CSSProperties = {
    padding: "10px 14px",
    fontSize: "0.8rem",
    color: "var(--adm-text)",
    borderBottom: "1px solid var(--adm-sidebar-border)",
    verticalAlign: "top",
}

const trHoverCss = `
  .adm-table-row:hover { background: var(--adm-hover-bg) !important; }
`

function AdminTableWrapper({children}: { children: React.ReactNode }) {
    return (
        <>
            <style>{trHoverCss}</style>
            <div style={wrapperStyle}>{children}</div>
        </>
    )
}

function AdminTableHead({children, ...props}: React.ComponentProps<typeof TableHead>) {
    return <TableHead style={{...thStyle, ...props.style}} {...props}>{children}</TableHead>
}

function AdminTableCell({children, muted, mono, ...props}: React.ComponentProps<typeof TableCell> & {
    muted?: boolean;
    mono?: boolean
}) {
    const extra: React.CSSProperties = {}
    if (muted) extra.color = "var(--adm-muted)"
    if (mono) extra.fontFamily = "'Courier New', monospace"
    return <TableCell style={{...tdStyle, ...extra, ...props.style}} {...props}>{children}</TableCell>
}

function AdminTableRow({children, ...props}: React.ComponentProps<typeof TableRow>) {
    return <TableRow className="adm-table-row" style={{border: "none"}} {...props}>{children}</TableRow>
}

function AdminTableHeader({children, ...props}: React.ComponentProps<typeof TableHeader>) {
    return <TableHeader style={headStyle} {...props}>{children}</TableHeader>
}

export {
    AdminTableWrapper,
    Table as AdminTable,
    AdminTableHeader,
    TableBody as AdminTableBody,
    AdminTableRow,
    AdminTableHead,
    AdminTableCell,
    TableCaption as AdminTableCaption,
}
