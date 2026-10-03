import { LINE_LIKE_GROUP_TYPES } from '../../utils/groupAccepts'
import { markSelectionChrome } from '../../utils/svgExportShared'
import { SELECTION_PADDING } from '../../canvas/selectionController'

// Per-member selection outlines for a Shift-click group. A Shift-selection is
// a set of separate elements, so on top of the group frame each member gets
// its own outline, styled like the single-selection box. The outlines are
// children of the group overlay, so they move (and live-scale) with it.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwoLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any

const OUTLINE_SCREEN_WIDTH = 1.5

// Same token as the single-selection box (selectionController).
const outlineStroke = (): string => {
    const channels = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-ink')
        .trim()
    return channels ? `rgb(${channels})` : '#1A1612'
}

// The node whose box is the member's visible extent. Line-like members also
// hold endpoint hit circles, which would inflate the box; measure the line.
function measuredNode(coreObject: ShapeLike): Element | undefined {
    const type = coreObject?.elementData?.componentType
    const target = LINE_LIKE_GROUP_TYPES.has(type)
        ? coreObject.children?.[0]
        : coreObject
    return target?._renderer?.elem
}

// Create or re-fit one outline per member copy. Reads rendered SVG boxes, so
// the scene must be rendered first; call after two.update().
export function layoutMemberOutlines(
    two: TwoLike,
    group: ShapeLike,
    outlines: Map<string, ShapeLike>
): void {
    const svgRect = (
        two.renderer.domElement as SVGSVGElement
    ).getBoundingClientRect()
    const scale = two.scene.scale || 1
    const toLocalX = (clientX: number): number =>
        (clientX - svgRect.left - two.scene.translation.x) / scale -
        group.translation.x
    const toLocalY = (clientY: number): number =>
        (clientY - svgRect.top - two.scene.translation.y) / scale -
        group.translation.y
    const stroke = outlineStroke()

    Array.from(group.children as ShapeLike[]).forEach((coreObject) => {
        const id = coreObject?.elementData?.id
        if (!id) return
        const r = measuredNode(coreObject)?.getBoundingClientRect()
        if (!r || (r.width === 0 && r.height === 0)) return

        const left = toLocalX(r.left) - SELECTION_PADDING
        const right = toLocalX(r.right) + SELECTION_PADDING
        const top = toLocalY(r.top) - SELECTION_PADDING
        const bottom = toLocalY(r.bottom) + SELECTION_PADDING

        let outline = outlines.get(id)
        if (!outline) {
            outline = two.makeRectangle(0, 0, 0, 0)
            outline.noFill()
            group.add(outline)
            outlines.set(id, outline)
        }
        outline.stroke = stroke
        outline.linewidth = OUTLINE_SCREEN_WIDTH / scale
        outline.translation.x = (left + right) / 2
        outline.translation.y = (top + bottom) / 2
        outline.width = right - left
        outline.height = bottom - top
    })

    two.update()
    // Tag after render so the node exists; exports strip selection chrome.
    outlines.forEach((outline) => markSelectionChrome(outline))
}
