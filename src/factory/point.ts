import Main from './main'
import Two from 'two.js'
import {
    POINT_RADIUS,
    POINT_LABEL_GAP,
    POINT_COLOR,
    POINT_LABEL_COLOR,
    POINT_LABEL_FONT_SIZE,
    DEFAULT_TEXT_FONT_FAMILY,
} from '../constants/misc'
import { capCenterOffset } from '../utils/fontMetrics'

export interface PointProperties {
    fill?: string
    stroke?: string
    metadata?: {
        /** The location name shown beside the circle. Empty until typed. */
        label?: string
        resist?: number
        /**
         * The label's font family. Absent on every point written before the
         * font control existed — those read as `DEFAULT_TEXT_FONT_FAMILY`.
         */
        textFontFamily?: string
        /**
         * The label's font size, in surface units. Absent on every point
         * written before the size control existed — those read as
         * `POINT_LABEL_FONT_SIZE`.
         */
        textFontSize?: number
        /**
         * Legacy: the pre-generic point catalog wrote a category id here and
         * derived the pin's colour from it. Its presence is the marker for an
         * old point — see `pointColorOf`.
         */
        category?: string
    } | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any

/**
 * Set on the selection overlay that `point.tsx` parks inside the point's group.
 * `buildPointVisual` wipes the group to redraw, and the overlay is not part of
 * the drawing — without this marker every recolour would silently delete the
 * selector out from under a selected point.
 */
export const POINT_CHROME_FLAG = '__cbPointChrome'

/**
 * The colour a point's circle should render in.
 *
 * Points created before the generic redesign stored their *category's* colour
 * in `fill`/`stroke`, which was never a user choice — so those render in the
 * standard point colour instead, and only lose the legacy marker when the user
 * actually picks a colour (applyProperty strips `metadata.category` on write).
 */
export function pointColorOf(record: ShapeLike): string {
    if (record?.metadata?.category) return POINT_COLOR
    return record?.fill || record?.stroke || POINT_COLOR
}

/**
 * The font family a point's label should render in.
 *
 * Stored per record, seeded at creation from the shared text default (see
 * `handlePointElement` in primary.tsx) — a point written before the control
 * existed carries nothing and falls back to the design default.
 */
export function pointFontFamilyOf(record: ShapeLike): string {
    const family = record?.metadata?.textFontFamily
    return typeof family === 'string' && family
        ? family
        : DEFAULT_TEXT_FONT_FAMILY
}

/**
 * The font size a point's label should render at, in surface units.
 *
 * Stored per record, like the family — but seeded through the point's OWN
 * ladder (`pointLabelSizeFor`), because the shared default is a size *label*,
 * not a pixel count. See `pointFontFamilyOf`.
 */
export function pointFontSizeOf(record: ShapeLike): number {
    const size = record?.metadata?.textFontSize
    return typeof size === 'number' && size > 0 ? size : POINT_LABEL_FONT_SIZE
}

/** The label text of a point record, normalised to a string. */
export function pointLabelOf(record: ShapeLike): string {
    const label = record?.metadata?.label
    return typeof label === 'string' ? label : ''
}

/**
 * (Re)build a point's visual into `group`, in place: a fixed-radius filled
 * circle with its label set `POINT_LABEL_GAP` clear of the circle's edge,
 * left-aligned and vertically centred on the circle.
 *
 * Rebuilding in place (rather than remounting the component) is what lets a
 * recolour or a label edit land on an element whose React props are frozen at
 * mount — the same reason applyProperty reaches into the scene directly.
 */
export function buildPointVisual(
    two: ShapeLike,
    group: ShapeLike,
    opts: {
        color?: string
        label?: string
        fontFamily?: string
        fontSize?: number
    }
): void {
    const color = opts.color || POINT_COLOR

    // Snapshot first — the collection mutates as we remove. Selection chrome is
    // left in place: it belongs to the component, not the drawing.
    const existing: ShapeLike[] = [...(group.children || [])]
    existing.forEach((child: ShapeLike) => {
        if (child?.[POINT_CHROME_FLAG]) return
        group.remove(child)
    })

    const circle = new (Two as ShapeLike).Circle(0, 0, POINT_RADIUS)
    circle.fill = color
    circle.noStroke()
    group.add(circle)

    const family = opts.fontFamily || DEFAULT_TEXT_FONT_FAMILY
    const size = opts.fontSize || POINT_LABEL_FONT_SIZE

    // Drawn on the ALPHABETIC baseline and positioned by hand, not with
    // `baseline: 'middle'`. SVG's middle baseline centres the x-height, which
    // leaves the label floating ~0.1em above the circle — visible at every size
    // and by a different amount per font. `capCenterOffset` puts the cap band's
    // centre on the circle's centre instead. See utils/fontMetrics.ts.
    const label = new (Two as ShapeLike).Text(
        opts.label ?? '',
        POINT_RADIUS + POINT_LABEL_GAP,
        capCenterOffset(family, size)
    )
    label.alignment = 'left'
    label.baseline = 'baseline'
    label.size = size
    label.family = family
    // Fixed by design — the label is never recoloured with the circle.
    label.fill = POINT_LABEL_COLOR
    label.noStroke()
    group.add(label)
}

/**
 * The circle node of a built point group (for in-place recolouring) — the first
 * *content* child.
 *
 * Not a fixed index: a rebuild leaves any selection chrome in place and appends
 * the new circle and label after it, so the chrome ends up at index 0 and a
 * plain `children[0]` would hand a recolour the overlay instead of the pin.
 */
export function getPointCircle(group: ShapeLike): ShapeLike | null {
    const children = group?.children ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return children.find((c: any) => !c?.[POINT_CHROME_FLAG]) ?? null
}

/** The label node of a built point group (for in-place text edits). */
export function getPointLabelNode(group: ShapeLike): ShapeLike | null {
    const children = group?.children ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return children.find((c: any) => typeof c?.value === 'string') ?? null
}

export default class PointFactory extends Main<PointProperties> {
    group?: ShapeLike

    createElement(): { group: ShapeLike } {
        const two = this.two
        const group = two.makeGroup()

        buildPointVisual(two, group, {
            color: pointColorOf(this.properties),
            label: pointLabelOf(this.properties),
            fontFamily: pointFontFamilyOf(this.properties),
            fontSize: pointFontSizeOf(this.properties),
        })

        group.translation.x = parseInt(String(this.x))
        group.translation.y = parseInt(String(this.y))
        this.group = group
        return { group: this.group }
    }
}
