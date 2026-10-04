// Theme-toggle color flip.
//
// Core model (intentionally NOT a theme-dependent display transform):
//   • Colors are shown verbatim — whatever is stored is painted. Authoring is
//     WYSIWYG: pick #000 in dark mode and it stays #000.
//   • The ONLY time a color changes is at a theme toggle, where every color is
//     flipped to its paired counterpart — a pure, theme-independent involution:
//       #000 ↔ #fff, and each light palette shade ↔ its paired dark shade.
//     Flipping twice returns the original. The flip is persisted to the store
//     (see the toggle handler in newCanvas.tsx), so it survives reload and is
//     not clobbered by later edits. Users may freely re-pick a color afterward;
//     we never re-flip on their behalf except on the next toggle.

// Bidirectional shade pairs (light, dark) — derived from the palette in
// src/utils/constants.ts. Each light shade flips to its dark partner and back.
const SHADE_PAIRS: [string, string][] = [
    // red
    ['#FFBDAD', '#BF2600'],
    ['#FF8F73', '#DE350B'],
    ['#FF7452', '#FF5630'],
    // yellow
    ['#FFF0B3', '#FF8B00'],
    ['#FFE380', '#FF991F'],
    ['#FFC400', '#FFAB00'],
    // green
    ['#ABF5D1', '#006644'],
    ['#79F2C0', '#00875A'],
    ['#57D9A3', '#36B37E'],
    // teal
    ['#B3F5FF', '#008DA6'],
    ['#79E2F2', '#00A3BF'],
    ['#00C7E6', '#00B8D9'],
    // blue
    ['#B3D4FF', '#0747A6'],
    ['#4C9AFF', '#0052CC'],
    ['#2684FF', '#0065FF'],
    // purple
    ['#C0B6F2', '#403294'],
    ['#998DD9', '#5243AA'],
    ['#8777D9', '#6554C0'],
    // brown
    ['#EAD9C5', '#3D2410'],
    ['#D2B089', '#5E3A1A'],
    ['#B5824E', '#8C5A2B'],
    // neutral
    ['#97A0AF', '#172B4D'],
    ['#7A869A', '#253858'],
    ['#5E6C84', '#42526E'],
]

// Pure black ↔ white. Named/long forms also map (they normalize to #000/#fff on
// first flip, then toggle cleanly thereafter).
const BW_PAIRS: [string, string][] = [
    ['#000', '#fff'],
    ['#000000', '#ffffff'],
    ['black', '#fff'],
    ['white', '#000'],
]

const FLIP = new Map<string, string>()
for (const [a, b] of [...SHADE_PAIRS, ...BW_PAIRS]) {
    FLIP.set(a.toLowerCase(), b)
    // Only register the reverse when it doesn't clobber a forward entry, so the
    // canonical pairs stay involutive (e.g. '#fff' → '#000', not 'white').
    if (!FLIP.has(b.toLowerCase())) FLIP.set(b.toLowerCase(), a)
}

/**
 * The default ink for the active theme: white in dark mode, black in light.
 * Used as the fallback color for new text/strokes so they're legible on the
 * current canvas (it then flips on toggle like everything else).
 */
export const themeDefaultInk = (): string =>
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')
        ? '#fff'
        : '#000'

/**
 * Flip a color to its theme counterpart. Returns the input unchanged for any
 * color without a pair (off-palette customs, the default #3A342C ink, etc.).
 */
export const flipThemeColor = <T extends string | null | undefined>(
    color: T
): T | string => {
    if (!color) return color
    return FLIP.get(color.trim().toLowerCase()) ?? color
}

// ── element-kind predicates ──────────────────────────────────────────────
const FILLABLE_TYPES = new Set(['rectangle', 'circle', 'diamond'])
// Strokes that flip on toggle: arrow + line + curved paths + pencil + shape
// outlines (rectangle/circle/diamond), so every stroke stays visible across
// both themes. line/curvedLine share arrowLine's structure (a stroked line/path
// plus fixed-color handles), so paintElementStroke flips only the themed stroke
// and leaves the endpoint/vertex handles alone.
const STROKE_FLIP_TYPES = new Set([
    'arrowLine',
    'line',
    'curvedLine',
    // The head mirrors the curve's stroke (curvedPathElement's update hook).
    'curvedArrow',
    'pencil',
    'rectangle',
    'circle',
    'diamond',
])

export const isFillableShapeType = (
    componentType: string | null | undefined
): boolean => !!componentType && FILLABLE_TYPES.has(componentType)

export const isStrokeFlippableType = (
    componentType: string | null | undefined
): boolean => !!componentType && STROKE_FLIP_TYPES.has(componentType)

// ── Two.js node painters (used by the toggle handler) ────────────────────

/** Set `color` on a shape group's visible fill leaves, skipping the text layer
 *  and transparent hit areas. */
export const paintShapeFill = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    group: any,
    color: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    textLayer: any
): void => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const children: any[] = group?.children ?? []
    children.forEach((node) => {
        if (!node || node === textLayer) return
        if (typeof node.fill === 'string' && node.fill !== 'rgba(0,0,0,0)') {
            node.fill = color
        }
    })
}

/** Set `color` on the nodes whose current stroke is `oldColor` (the element's
 *  themed stroke), so fixed-color endpoint handles are left untouched. */
export const paintElementStroke = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    group: any,
    oldColor: string,
    color: string
): void => {
    const target = oldColor.toLowerCase()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const visit = (node: any): void => {
        if (!node) return
        if (Array.isArray(node.children) && node.children.length) {
            node.children.forEach(visit)
            return
        }
        if (
            typeof node.stroke === 'string' &&
            node.stroke.toLowerCase() === target
        ) {
            node.stroke = color
        }
    }
    visit(group)
}
