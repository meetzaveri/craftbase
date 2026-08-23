import {
    SHAPE_DEFAULT_STROKE,
    DEFAULT_TEXT_FONT_FAMILY,
} from '../constants/misc'
import { generateUUID } from './misc'
import { themeDefaultInk } from './themeColorFlip'
import { lineHeightFor, measureTextWidth, type FontSpec } from './textLayout'
import { reflowTextForShape } from './shapeTextFit'
import { isFontReady, runWhenFontReady } from './fontLoading'
import { scheduleRender } from './renderScheduler'

// Two.js scene/shape objects in the codebase carry extra bookkeeping fields
// (elementData, _renderer, etc.) that aren't part of the published types. Keep
// these parameters loose; Stages 7–9 will install canonical scene types.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwoLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ZUILike = any

// Tinted group background. The group surface must read as a subtle *darker*
// overlay on the light parchment and a subtle *lighter* overlay on the dark
// canvas, so members stay readable and the group reads as a raised surface in
// both themes. In light mode we tint with the dark `--color-topbar` token; in
// dark mode that token is near-black and would make the group look darker than
// the canvas, so we tint with the light `--color-ink` token instead. This is a
// Two.js scene color (static string, not a CSS class) so it can't inherit the
// token otherwise. Low alpha keeps members readable underneath.
export const getGroupFill = (): string => {
    if (typeof document === 'undefined') return 'rgba(26, 22, 18, 0.1)'
    const isDark = document.documentElement.classList.contains('dark')
    const token = isDark ? '--color-ink' : '--color-topbar'
    const channels = getComputedStyle(document.documentElement)
        .getPropertyValue(token)
        .trim()
    const rgb = channels ? channels.split(/\s+/).join(', ') : '26, 22, 18'
    return `rgba(${rgb}, ${isDark ? 0.12 : 0.1})`
}

interface MouseLikeEvent {
    clientX: number
    clientY: number
}

interface ShapeStyleUpdate {
    fill?: string
    stroke?: string | null
    linewidth?: number
    opacity?: number
}

// Show or hide the endpoint circles on an arrowLine group.
// children[1] and children[2] are the endpoint handle groups.
export function setArrowEndpointsVisible(
    shape: ShapeLike,
    visible: boolean
): void {
    const opacity = visible ? 1 : 0
    if (shape?.children?.[1]) shape.children[1].opacity = opacity
    if (shape?.children?.[2]) shape.children[2].opacity = opacity
}

// Single source of truth for reading an element's opacity off a store row /
// props / elementData. Opacity is persisted in the top-level `opacity` column
// for every element type. The legacy `metadata.opacity` read is kept as a
// fallback so bases saved before the migration still render dimmed (pencil
// never used metadata.opacity — its metadata is the vertex array — so the
// Array guard also covers it). Absent everywhere → fully opaque.
export function readOpacity(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    source: any
): number {
    if (!source) return 1
    if (typeof source.opacity === 'number') return source.opacity
    const meta = source.metadata
    if (meta && !Array.isArray(meta) && typeof meta.opacity === 'number') {
        return meta.opacity
    }
    return 1
}

// Convert a mouse event's client coords to Two.js surface coords via ZUI.
export function clientToSurface(
    zui: ZUILike,
    e: MouseLikeEvent
): { x: number; y: number } {
    return zui.clientToSurface(e.clientX, e.clientY)
}

// Apply visual style properties to a Two.js shape.
export function applyShapeStyle(
    shape: ShapeLike,
    { fill, stroke, linewidth, opacity }: ShapeStyleUpdate = {}
): void {
    if (fill !== undefined) shape.fill = fill
    if (stroke !== undefined) shape.stroke = stroke || SHAPE_DEFAULT_STROKE
    if (linewidth !== undefined) shape.linewidth = linewidth
    if (opacity !== undefined) shape.opacity = opacity
}

// Component-row shape passed into cloneElementData. Loose-but-honest mapping
// over the DB schema; full ComponentRecord shape lives in src/types/base.ts
// but cloneElementData also handles canvas-only fields (relativeX/Y), hence
// the local interface.
interface ElementCloneSource {
    componentType: string
    /**
     * Which base the element belongs to. MUST be carried through a clone: it is
     * the only thing marking a geo object as geo, and for the pencil — offered
     * on every base — it is the only thing that says which base it was drawn on.
     * Dropping it silently relocates the pasted copy to the wrong base.
     */
    objectClass?: 'shape' | 'geo'
    x1: number
    y1: number
    x2: number
    y2: number
    width: number
    height: number
    fill: string
    stroke: string | null
    strokeType: string | null
    linewidth: number | null
    radius: number | null
    iconStroke: string | null
    textColor: string | null
    opacity?: number | null
    metadata: unknown
    children: unknown
    relativeX?: number
    relativeY?: number
    // Connector port bindings (arrowLine only). Cloned as-is; the paste path
    // remaps the shape ids to the pasted counterparts (group paste) or keeps
    // them pointing at the still-present originals (single paste).
    tailShapeId?: string | null
    tailEdge?: string | null
    tailPortIndex?: number | null
    headShapeId?: string | null
    headEdge?: string | null
    headPortIndex?: number | null
}

interface ClonedElement extends ElementCloneSource {
    id: string
    baseId: string
    x: number
    y: number
}

// Deep-clone a canvas element's data for copy/paste, assigning a new UUID
// and positioning at (newX, newY).
export function cloneElementData(
    src: ElementCloneSource,
    baseId: string,
    newX: number,
    newY: number
): ClonedElement {
    const cloned: ClonedElement = {
        id: generateUUID(),
        baseId,
        componentType: src.componentType,
        ...(src.objectClass ? { objectClass: src.objectClass } : {}),
        x: newX,
        y: newY,
        x1: src.x1,
        y1: src.y1,
        x2: src.x2,
        y2: src.y2,
        width: src.width,
        height: src.height,
        fill: src.fill,
        stroke: src.stroke,
        strokeType: src.strokeType,
        linewidth: src.linewidth,
        radius: src.radius,
        iconStroke: src.iconStroke,
        textColor: src.textColor,
        opacity: readOpacity(src),
        metadata: Array.isArray(src.metadata)
            ? src.metadata.map((p: unknown) =>
                  typeof p === 'object' && p !== null ? { ...p } : p
              )
            : src.metadata
              ? { ...(src.metadata as Record<string, unknown>) }
              : {},
        children: src.children
            ? typeof structuredClone === 'function'
                ? structuredClone(src.children)
                : JSON.parse(JSON.stringify(src.children))
            : null,
    }
    if (src.relativeX !== undefined) cloned.relativeX = src.relativeX
    if (src.relativeY !== undefined) cloned.relativeY = src.relativeY
    if (src.componentType === 'arrowLine') {
        cloned.tailShapeId = src.tailShapeId ?? null
        cloned.tailEdge = src.tailEdge ?? null
        cloned.tailPortIndex = src.tailPortIndex ?? 0
        cloned.headShapeId = src.headShapeId ?? null
        cloned.headEdge = src.headEdge ?? null
        cloned.headPortIndex = src.headPortIndex ?? 0
    }
    return cloned
}

interface ResolveResult {
    shape: ShapeLike | null
    avoidDragging: boolean
}

// Walk the DOM event path to find the Two.js group and determine drag behavior.
export function resolveShapeFromPath(
    path: EventTarget[] | undefined,
    two: TwoLike
): ResolveResult {
    let shape: ShapeLike | null = null
    let avoidDragging = false

    if (!path) return { shape, avoidDragging }

    path.forEach((rawItem) => {
        const item = rawItem as HTMLElement
        const classList = item?.classList
        if (classList?.value?.includes('avoid-dragging')) {
            avoidDragging = true
            if (item.tagName === 'g' && shape == null) {
                shape =
                    two.scene.children.find(
                        (child: ShapeLike) => child.id === item.id
                    ) ?? null
            }
        }

        if (
            item.tagName === 'g' &&
            classList?.value?.includes('dragger-picker') &&
            shape == null
        ) {
            if (classList.value.includes('is-line-circle')) {
                const el = document.getElementById(item.id)
                const parentId = el?.getAttribute('data-parent-id')
                const lineId = el?.getAttribute('data-line-id')
                const direction = el?.getAttribute('data-direction')

                const getParentTwoData = two.scene.children.find(
                    (child: ShapeLike) => child.id === parentId
                )
                const getChildTwoData = getParentTwoData.children.find(
                    (child: ShapeLike) => child.id === item.id
                )
                const getSiblingChild = getParentTwoData.children.find(
                    (child: ShapeLike) =>
                        child.id !== item.id && child?.children?.length > 0
                )
                const getLineTwoData = getParentTwoData.children.find(
                    (child: ShapeLike) => child.id === lineId
                )

                shape = getChildTwoData
                shape.lineData = getLineTwoData
                shape.direction = direction
                shape.siblingCircle = getSiblingChild
                shape.opacity = 1
                shape.siblingCircle.opacity = 1
                shape.elementData = {
                    isGroupSelector: false,
                    isLineCircle: true,
                    lineData: getLineTwoData,
                    parentData: getParentTwoData,
                }
            } else {
                shape = two.scene.children.find(
                    (child: ShapeLike) => child.id === item.id
                )
                if (shape?.elementData?.componentType === 'arrowLine') {
                    setArrowEndpointsVisible(shape, true)
                }
            }
        }
    })

    return { shape, avoidDragging }
}

interface PollOptions {
    condition?: (el: ShapeLike) => boolean
    maxRetries?: number
    onTimeout?: () => void
}

/**
 * Poll `two.scene.children` for an element with the given id, calling
 * `onFound(el)` once the element (and optional extra condition) is present.
 * Falls back to `onTimeout()` after `maxRetries` animation frames.
 */
export function pollUntilElement(
    two: TwoLike,
    id: string,
    onFound: (el: ShapeLike) => void,
    { condition = () => true, maxRetries = 300, onTimeout }: PollOptions = {}
): void {
    const attempt = (retries: number): void => {
        const el = two.scene.children.find(
            (child: ShapeLike) => child?.elementData?.id === id
        )
        if (el && condition(el)) {
            onFound(el)
        } else if (retries < maxRetries) {
            requestAnimationFrame(() => attempt(retries + 1))
        } else {
            onTimeout?.()
        }
    }
    requestAnimationFrame(() => attempt(0))
}

// ── Shape text layer ──
// Multiline text inside a shape lives in a dedicated, detectable sub-group
// (one Two.Text per visual line). The marker `elementData.isTextLayer` lets
// every consumer (group-apply, inspector, selection/resize) ask "is this the
// text group?" and "give me all the line nodes" without ad-hoc value sniffing.

export interface ShapeTextStyle {
    fill: string
    size: number
    family: string
    weight?: string | number
    alignment?: 'center' | 'left' | 'right'
    baseline?: string
    lineHeight?: number
}

// Return the tagged text-layer sub-group of `group`, or null.
export function findShapeTextLayer(group: ShapeLike): ShapeLike | null {
    const children = group?.children
    if (!children) return null
    for (let i = 0; i < children.length; i++) {
        if (children[i]?.elementData?.isTextLayer === true) return children[i]
    }
    return null
}

// All Two.Text line nodes for a shape. Falls back to legacy direct
// string-valued children so callers stay correct mid-migration.
export function getShapeTextNodes(group: ShapeLike): ShapeLike[] {
    const layer = findShapeTextLayer(group)
    const source = layer ? layer.children : group?.children
    if (!source) return []
    // `source` is a Two.js `Children` collection (a custom Array subclass with
    // no Symbol.species). Calling `.filter` on it directly routes through
    // `ArraySpeciesCreate(new Children(0))`, whose constructor mishandles the
    // numeric length and seeds the result with a spurious `0`. When there are
    // no text nodes that `0` survives, so the filter returns `[0]` instead of
    // `[]` — and any caller dereferencing the result (`n.opacity`, `n.fill`)
    // throws `Cannot create property … on number '0'`. Copy to a plain array
    // first so the filter is well-behaved and returns `[]` for text-less shapes.
    return Array.from(source as ArrayLike<ShapeLike>).filter(
        (c: ShapeLike) => typeof c?.value === 'string'
    )
}

/**
 * Keep a transparent, full-block hit-area rectangle inside a STANDALONE text
 * group, sized to the rendered multiline block (anchored left/middle at the
 * group origin, matching the text layout).
 *
 * Why this exists: an SVG `<text>` only catches pointer events on the glyphs
 * themselves. For multiline text rendered as stacked `<text>` nodes, the blank
 * gaps between lines (and the padding around them) belong to no element, so a
 * click there misses the group `<g>` entirely and `resolveShapeFromPath` reads
 * it as "empty canvas" — the text can't be selected as a whole. A
 * transparent-but-painted (`rgba(0,0,0,0)`) rect spanning the block restores a
 * solid hit target across the whole block. (This is what the old per-element
 * `ObjectSelector.area` path used to provide before selection moved to the
 * generic SelectionController.)
 *
 * Idempotent: creates the rect on first call (tagged via `_isTextHitArea`),
 * resizes it on later calls. Added AFTER line 1 so `group.children[0]` stays
 * the text node the SelectionController attaches to, and excluded from
 * `getShapeTextNodes` (no string `value`).
 */
/**
 * Give an element's rendered SVG node DOM focus.
 *
 * Blink focuses any SVG node on a bare `.focus()`; WebKit only focuses one that
 * is explicitly focusable, and silently does nothing otherwise. Selection here
 * rides on DOM focus/blur of the element's `<g>` — the `groupFocused` event
 * behind group copy/paste, the delete-key handlers, deselect-on-blur — so
 * without a tabindex every one of those events goes missing in Safari while
 * working fine in Chrome. `-1` makes the node programmatically focusable
 * without putting it in the tab order; the outline reset keeps Safari from
 * painting a focus ring around the shape.
 */
export function focusSvgElement(el: Element | null | undefined): void {
    if (!el) return
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
    const focusable = el as Element & {
        style?: CSSStyleDeclaration
        focus?: () => void
    }
    if (focusable.style) focusable.style.outline = 'none'
    focusable.focus?.()
}

export function syncTextHitRect(two: TwoLike, group: ShapeLike): void {
    const nodes = getShapeTextNodes(group)
    if (!nodes.length) return
    const size = nodes[0]?.size || 36
    const lineH = lineHeightFor(size)
    let maxW = 20
    nodes.forEach((nd) => {
        const w = measureTextWidth(nd?.value || '', {
            family: nd?.family || DEFAULT_TEXT_FONT_FAMILY,
            size: nd?.size || size,
            weight: nd?.weight,
        })
        maxW = Math.max(maxW, w)
    })
    const blockH = Math.max(nodes.length * lineH, size)

    let rect = Array.from(group.children as ArrayLike<ShapeLike>).find(
        (c: ShapeLike) => c?._isTextHitArea
    )
    if (!rect) {
        rect = two.makeRectangle(0, 0, maxW, blockH)
        rect.fill = 'rgba(0,0,0,0)'
        rect.noStroke()
        rect._isTextHitArea = true
        group.add(rect)
    }
    rect.width = maxW
    rect.height = blockH
    // Text is left-aligned at the group origin (extends right) and vertically
    // centered on it, so center the rect at (width/2, 0).
    rect.translation.set(maxW / 2, 0)
}

/**
 * Lay out STANDALONE text (the `newText` kind) as a vertical stack of one
 * Two.Text per hard-newline line, centered on the group origin. An SVG <text>
 * collapses `\n`, so multiline standalone text must be rendered as stacked
 * nodes — newText's component does this internally, but the same layout is
 * needed whenever the text is re-materialised outside that component (e.g. as a
 * cloned member of a group selection). Reuses any existing line nodes (line 1 is
 * the factory's text node), adds nodes for new lines, removes surplus ones.
 *
 * Keep in sync with newText.tsx's `syncMultilineLayout`.
 */
export function layoutStandaloneText(
    two: TwoLike,
    group: ShapeLike,
    content: string,
    size: number
): void {
    const nodes = getShapeTextNodes(group)
    const first = nodes[0]
    if (!first) return
    const lines = (content || '').split('\n')
    const n = lines.length
    const lineH = lineHeightFor(size)

    first.value = lines[0] ?? ''
    first.size = size
    first.leading = size
    first.translation.set(0, (0 - (n - 1) / 2) * lineH)

    const extra = nodes.slice(1)
    for (let i = 1; i < n; i++) {
        let node = extra[i - 1]
        if (!node) {
            node = two.makeText(lines[i] ?? '', 0, 0)
            group.add(node)
        }
        node.value = lines[i] ?? ''
        node.fill = first.fill
        node.size = size
        node.leading = size
        node.family = first.family
        node.alignment = first.alignment
        node.baseline = first.baseline
        node.opacity = first.opacity
        node.translation.set(0, (i - (n - 1) / 2) * lineH)
    }

    if (extra.length > n - 1) {
        const surplus = extra.slice(n - 1)
        if (surplus.length) group.remove(surplus)
    }
}

/**
 * Render `lines` as a vertical stack of Two.Text nodes inside `group`'s text
 * layer, creating the layer on first use. Existing line nodes are reused
 * (value/position/style updated) and only the surplus is removed — we never
 * `two.remove` the layer group itself, sidestepping the documented Two.js
 * `scene.subtractions` double-removal crash. Caller owns `two.update()`.
 *
 * Lines are centered as a block around the group origin (the shape Path is
 * also centered there), so no `group.center()` is needed.
 */
export function renderShapeTextLayer(
    two: TwoLike,
    group: ShapeLike,
    lines: string[],
    style: ShapeTextStyle
): ShapeLike {
    let layer = findShapeTextLayer(group)
    if (!layer) {
        layer = two.makeGroup()
        layer.elementData = { isTextLayer: true }
        group.add(layer)
    }

    const lineH = style.lineHeight ?? lineHeightFor(style.size)
    const n = lines.length
    const alignment = style.alignment ?? 'left'

    // Two.Text positions relative to its translation per `alignment`. For a
    // left-aligned block we shift every line left by half the widest line so
    // the block stays centered in the shape while each line shares one left
    // edge (ragged right).
    let blockX = 0
    if (alignment === 'left') {
        const font: FontSpec = {
            family: style.family,
            size: style.size,
            weight: style.weight,
        }
        let maxW = 0
        for (const ln of lines) {
            const w = measureTextWidth(ln, font)
            if (w > maxW) maxW = w
        }
        blockX = -maxW / 2
    }

    for (let i = 0; i < n; i++) {
        const y = (i - (n - 1) / 2) * lineH
        let node = layer.children[i]
        if (!node || typeof node.value !== 'string') {
            node = two.makeText(lines[i] ?? '', blockX, y)
            layer.add(node)
        } else {
            node.value = lines[i] ?? ''
        }
        node.translation.set(blockX, y)
        node.fill = style.fill
        node.size = style.size
        node.family = style.family
        node.alignment = alignment
        node.baseline = style.baseline ?? 'middle'
        if (style.weight !== undefined) node.weight = style.weight
    }

    // Drop surplus line nodes from a previous, longer render.
    if (layer.children.length > n) {
        const extras = layer.children.slice(n)
        layer.remove(extras)
    }

    return layer
}

// Derive the text style + measurement font from a shape's metadata, matching
// the historical single-makeText defaults (Caveat / theme ink / size 24).
export function shapeTextStyleFromMeta(meta: ShapeLike): {
    style: ShapeTextStyle
    font: FontSpec
} {
    const family =
        meta?.textFontFamily || meta?.textFamily || DEFAULT_TEXT_FONT_FAMILY
    const size = meta?.textFontSize || 24
    const weight = meta?.textWeight || 'normal'
    return {
        style: {
            fill: meta?.textFill || themeDefaultInk(),
            size,
            family,
            weight,
            alignment: 'left',
            baseline: meta?.textBaseLine || 'middle',
        },
        font: { family, size, weight },
    }
}

/**
 * Reflow a shape's text to its current width and render it into the text
 * layer. Single entry point used by the rectangle/diamond/circle components
 * on mount and whenever width/metadata change, so persisted bases reflow
 * deterministically from raw content + width (no wrapped text is stored).
 * Caller owns `two.update()`.
 *
 * If the text's webfont hasn't loaded yet, the wrap is measured against a
 * fallback face and re-run for free once the real one lands — see
 * `./fontLoading`. That second pass owns its own render (its caller is long
 * gone by then).
 */
export function applyShapeText(
    two: TwoLike,
    group: ShapeLike,
    kind: string,
    width: number,
    meta: ShapeLike
): void {
    if (!meta?.hasText) return
    const raw = typeof meta.textContent === 'string' ? meta.textContent : ''
    const { style, font } = shapeTextStyleFromMeta(meta)
    const { lines } = reflowTextForShape(kind, width, raw, font)
    renderShapeTextLayer(two, group, lines, style)

    if (isFontReady(font)) return
    runWhenFontReady(font, () => {
        // The shape may have been deleted while we waited; Two.js deletes
        // `parent` on remove, so this skips detached groups.
        if (!group?.parent) return
        // Re-read the width off the shape path (children[0]) rather than
        // trusting the captured one — a resize in the meantime moved it.
        const liveWidth = group.children?.[0]?.width ?? width
        const { lines: reflowed } = reflowTextForShape(
            kind,
            liveWidth,
            raw,
            font
        )
        renderShapeTextLayer(two, group, reflowed, style)
        scheduleRender(two)
    })
}
