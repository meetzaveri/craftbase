// The element craftbase is mounted in when embedded via the npm <Craftbase>
// component (the `.cb-embed` div). Null in the standalone app, where every
// helper here falls back to the page-level element it used before:
//
// - theme:   the `dark` class + CSS color variables live on the embed root
//            (scoped so they never touch the host page) instead of <html>.
// - portals: modals mount inside the root so they inherit the scoped CSS.
// - sizing:  the canvas viewport is the root's box, not the window.
//
// Single instance per page (v1): one module-level root.

let embedRoot: HTMLElement | null = null

export function setEmbedRoot(el: HTMLElement | null): void {
    embedRoot = el
}

export function getEmbedRoot(): HTMLElement | null {
    return embedRoot
}

/** Element carrying the `dark` class and the theme CSS variables. */
export function getThemeRoot(): HTMLElement {
    return embedRoot ?? document.documentElement
}

export function isDarkTheme(): boolean {
    return getThemeRoot().classList.contains('dark')
}

/** Default parent for <Portal>. */
export function getPortalRoot(): HTMLElement {
    return embedRoot ?? document.body
}

/**
 * Viewport-space position of the canvas box's top-left corner. {0,0} in the
 * standalone app (the canvas is the window). In the embed, every overlay that
 * is placed from `clientX/clientY` or `getBoundingClientRect()` must subtract
 * this: chrome inside the embed root is positioned relative to the root
 * (`contain: layout paint` makes it the containing block for `fixed` too).
 */
export function getCanvasOrigin(): { left: number; top: number } {
    if (!embedRoot) return { left: 0, top: 0 }
    const r = embedRoot.getBoundingClientRect()
    return { left: r.left, top: r.top }
}

/** Size of the canvas box — the window in the app, the root in the embed. */
export function getCanvasSize(): { width: number; height: number } {
    if (!embedRoot) {
        return { width: window.innerWidth, height: window.innerHeight }
    }
    const r = embedRoot.getBoundingClientRect()
    return { width: r.width, height: r.height }
}

/** Convert viewport (client) coordinates to canvas-box-local coordinates. */
export function toCanvasLocal(
    clientX: number,
    clientY: number
): { x: number; y: number } {
    const o = getCanvasOrigin()
    return { x: clientX - o.left, y: clientY - o.top }
}

// --- Event scoping (embed only) ------------------------------------------
// Craftbase listens for shortcuts (Delete, Ctrl+Z/C/V, T, ...) on `window`.
// Embedded, those keys may belong to the host page — e.g. typing in the host's
// own input. A capture-phase listener tags such events as "foreign" (it never
// stops them, so the host still gets them) and every window-level craftbase
// handler bails early on a foreign event via `isForeignEvent`.

const foreignEvents = new WeakSet<Event>()

/** True when an event belongs to the host page, not the embedded board. */
export function isForeignEvent(e: Event): boolean {
    return foreignEvents.has(e)
}

/**
 * Start tagging foreign keyboard events for the embed root. A key event is
 * the board's when focus is inside the root, or when nothing in particular is
 * focused (body) and the user last pointed inside the root.
 */
export function installEmbedEventScope(root: HTMLElement): () => void {
    let lastPointerInside = false
    const onPointerDown = (e: Event): void => {
        lastPointerInside = e.target instanceof Node && root.contains(e.target)
    }
    const onKey = (e: Event): void => {
        const t = e.target
        const onPageRoot =
            !t || t === document.body || t === document.documentElement
        const inside = t instanceof Node && root.contains(t)
        if (inside) return
        if (onPageRoot && lastPointerInside) return
        foreignEvents.add(e)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('keyup', onKey, true)
    return (): void => {
        document.removeEventListener('pointerdown', onPointerDown, true)
        window.removeEventListener('keydown', onKey, true)
        window.removeEventListener('keyup', onKey, true)
    }
}
