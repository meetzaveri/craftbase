// Screen-space DOM overlay for the shape-creation drag preview.
//
// Why this exists: while you drag out a new rectangle/circle/diamond, the old
// path added the preview as a child of the Two.js scene and called
// `two.update()` every mousemove. That repaints the SVG region under the
// growing preview — and at low zoom the preview covers most of a dense board,
// so the browser re-rasterises thousands of nested SVG nodes per frame (3-5fps
// at 10% zoom). The scene itself isn't changing during the drag, only the
// preview is, so there's no reason to touch the scene SVG at all.
//
// Instead we draw the preview as a single absolutely-positioned DOM element on
// its own layer. Updating it is O(1) CSS and never dirties the scene SVG, so
// the create-drag stays 60fps regardless of zoom or element count. The real
// Two.js shape is still materialised on mouseup (unchanged) — this is purely
// the transient drag visual.

export type DrawPreviewKind = 'rectangle' | 'circle' | 'diamond'

interface DrawPreviewStyle {
    fill?: string
    stroke?: string
    linewidth?: number
    opacity?: number
}

const SVG_NS = 'http://www.w3.org/2000/svg'

let overlayEl: HTMLDivElement | null = null

// Create (or replace) the preview element and attach it to <body>. Positioned
// in viewport (client) coordinates, so callers pass raw clientX/clientY — no
// world<->screen conversion, no dependence on the canvas element's offset.
export function createDrawPreview(
    kind: DrawPreviewKind,
    style: DrawPreviewStyle
): void {
    removeDrawPreview()

    const el = document.createElement('div')
    const s = el.style
    s.position = 'fixed'
    s.left = '0px'
    s.top = '0px'
    s.width = '0px'
    s.height = '0px'
    s.pointerEvents = 'none'
    s.zIndex = '50'
    s.boxSizing = 'border-box'
    s.opacity = String(style.opacity ?? 0.6)
    s.willChange = 'left, top, width, height'

    const stroke = style.stroke || '#000'
    const fill = style.fill || '#fff'
    const lw = style.linewidth || 1

    if (kind === 'circle') {
        s.background = fill
        s.borderRadius = '50%'
        s.border = `${lw}px solid ${stroke}`
    } else if (kind === 'diamond') {
        // A CSS border can't follow a clip-path edge, so a clip-path-only
        // diamond has no visible outline — with a light fill it's invisible
        // mid-drag. Render an inline SVG polygon instead so it carries a real
        // stroke. viewBox + preserveAspectRatio:none stretches the unit diamond
        // to the div; non-scaling-stroke keeps the outline a constant px width.
        const svg = document.createElementNS(SVG_NS, 'svg')
        svg.setAttribute('width', '100%')
        svg.setAttribute('height', '100%')
        svg.setAttribute('viewBox', '0 0 100 100')
        svg.setAttribute('preserveAspectRatio', 'none')
        svg.style.display = 'block'
        svg.style.overflow = 'visible'
        const poly = document.createElementNS(SVG_NS, 'polygon')
        poly.setAttribute('points', '50,1 99,50 50,99 1,50')
        poly.setAttribute('fill', fill)
        poly.setAttribute('stroke', stroke)
        poly.setAttribute('stroke-width', String(lw))
        poly.setAttribute('vector-effect', 'non-scaling-stroke')
        svg.appendChild(poly)
        el.appendChild(svg)
    } else {
        s.background = fill
        s.borderRadius = '3px'
        s.border = `${lw}px solid ${stroke}`
    }

    document.body.appendChild(el)
    overlayEl = el
}

// Position/size the preview from the drag's two corners, in client coords.
export function updateDrawPreview(
    x0: number,
    y0: number,
    x1: number,
    y1: number
): void {
    if (!overlayEl) return
    const s = overlayEl.style
    s.left = `${Math.min(x0, x1)}px`
    s.top = `${Math.min(y0, y1)}px`
    s.width = `${Math.abs(x1 - x0)}px`
    s.height = `${Math.abs(y1 - y0)}px`
}

export function removeDrawPreview(): void {
    if (overlayEl) {
        overlayEl.remove()
        overlayEl = null
    }
}

export function hasDrawPreview(): boolean {
    return overlayEl !== null
}
