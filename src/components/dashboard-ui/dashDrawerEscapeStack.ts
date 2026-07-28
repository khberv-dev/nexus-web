/** Стек обработчиков Escape для вложенных правых шторок (последняя открытая закрывается первой). */

type Entry = { close: () => void }

const stack: Entry[] = []

function onGlobalKey(e: KeyboardEvent) {
  if (e.key !== "Escape" || stack.length === 0) return
  stack[stack.length - 1]?.close()
  e.preventDefault()
  e.stopPropagation()
}

let attached = false

export function registerDashDrawerEscape(close: () => void): () => void {
  if (typeof window === "undefined") return () => {}

  const entry: Entry = { close }
  stack.push(entry)

  if (!attached) {
    window.addEventListener("keydown", onGlobalKey, true)
    attached = true
  }

  return () => {
    const i = stack.lastIndexOf(entry)
    if (i >= 0) stack.splice(i, 1)
    if (stack.length === 0 && attached) {
      window.removeEventListener("keydown", onGlobalKey, true)
      attached = false
    }
  }
}
