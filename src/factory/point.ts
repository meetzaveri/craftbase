import Main from './main'
import Two from 'two.js'
import {
    DEFAULT_GEO_RING_RADIUS,
    POINT_CATEGORIES,
    DEFAULT_POINT_CATEGORY,
} from '../constants/misc'

export interface PointProperties {
    stroke?: string
    metadata?: {
        category?: string
        svgIcon?: string
        resist?: number
        ringRadius?: number
    } | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any

// Read viewBox so we can center the interpreted icon inside the pin. Defaults
// to a 24x24 box (the standard icon viewport) when absent.
function parseViewBox(svg: string): { x: number; y: number; w: number; h: number } {
    const m = /viewBox\s*=\s*["']([^"']+)["']/i.exec(svg)
    if (m && m[1]) {
        const p = m[1].split(/[\s,]+/).map(Number)
        if (p.length === 4 && p.every((n) => Number.isFinite(n))) {
            return { x: p[0]!, y: p[1]!, w: p[2]!, h: p[3]! }
        }
    }
    return { x: 0, y: 0, w: 24, h: 24 }
}

// (Re)build a point's filled-square pin into `group`, in place. Clears any prior
// children so it can also re-skin an existing point when its category changes
// (see applyPointCategory). The pin is a hard-shadowed rounded square in the
// category color with a white (or dark, for ghost) icon centered on top — the
// whole group is counter-scaled by the caller so it stays legible on zoom-out.
export function buildPointVisual(
    two: ShapeLike,
    group: ShapeLike,
    opts: { category?: string; ringRadius?: number }
): void {
    const category = opts.category || DEFAULT_POINT_CATEGORY
    const cat = POINT_CATEGORIES[category] || POINT_CATEGORIES[DEFAULT_POINT_CATEGORY]!
    const ringRadius = opts.ringRadius ?? DEFAULT_GEO_RING_RADIUS

    // Clear existing children (snapshot first — the collection mutates as we go).
    const existing: ShapeLike[] = [...(group.children || [])]
    existing.forEach((child) => group.remove(child))

    const size = ringRadius * 2
    const corner = size * 0.26 // matches the HTML's ~11px radius on a 42px pin

    // Hard offset shadow (behind everything).
    const shadow = new (Two as ShapeLike).RoundedRectangle(3, 3, size, size, corner)
    shadow.fill = '#C4B89A'
    shadow.noStroke()
    group.add(shadow)

    // Filled background — the category color. Opaque, so it's the click target.
    const bg = new (Two as ShapeLike).RoundedRectangle(0, 0, size, size, corner)
    bg.fill = cat.bg
    if (cat.border) {
        bg.stroke = cat.border
        bg.linewidth = 2
    } else {
        bg.noStroke()
    }
    group.add(bg)

    // Icon — colors are baked into the catalog svg, so interpret as-is.
    try {
        const doc = new DOMParser().parseFromString(cat.svgIcon, 'image/svg+xml')
        const svgNode = doc.documentElement as unknown as SVGElement
        const icon = two.interpret(svgNode, false, false)
        if (icon) {
            const vb = parseViewBox(cat.svgIcon)
            const s = (ringRadius * 0.95) / Math.max(vb.w, vb.h)
            icon.scale = s
            icon.translation.set(
                -(vb.x + vb.w / 2) * s,
                -(vb.y + vb.h / 2) * s
            )
            group.add(icon)
        }
    } catch {
        // Bad SVG → keep the colored square (still a usable pin).
    }
}

export default class PointFactory extends Main<PointProperties> {
    group?: ShapeLike

    createElement(): { group: ShapeLike } {
        const two = this.two
        const meta = this.properties.metadata || {}
        const group = two.makeGroup()

        buildPointVisual(two, group, {
            category: meta.category,
            ringRadius: meta.ringRadius,
        })

        group.translation.x = parseInt(String(this.x))
        group.translation.y = parseInt(String(this.y))
        this.group = group
        return { group: this.group }
    }
}
