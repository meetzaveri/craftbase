// Shift-click multi-select helpers. Shift-click adds an element to the
// current selection, or removes it if it's already in. Two or more elements
// become a group overlay (the same groupobject the drag-select box builds), so
// property edits, move, resize, delete and copy all work unchanged.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwoLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any

// Padding around the members' union box, in screen px, so the group frame
// doesn't sit right on the member edges.
const GROUP_BOUNDS_PAD_PX = 8

// Ids of the active group overlay's members.
export function groupMemberIds(group: ShapeLike): string[] {
    const children = group?.elementData?.children
    if (!Array.isArray(children)) return []
    return children
        .map((c: ShapeLike) => c?.id)
        .filter((id: unknown): id is string => typeof id === 'string')
}

// The id of the element a Shift-click landed on, or null when it didn't land
// on a selectable element.
//
// `shape` is what resolveShapeFromPath found. While a group overlay is up, a
// click inside its box resolves to the overlay itself: its transparent
// backing rect covers the whole box, including non-members that sit inside it.
// So read every node under the cursor, front to back, and take the first that
// is a member copy (inside the overlay) or a real scene element.
export function resolveShiftClickId(
    shape: ShapeLike,
    activeGroup: ShapeLike,
    two: TwoLike,
    clientX: number,
    clientY: number
): string | null {
    // Endpoint circles keep their Shift behavior (axis-snapped endpoint drag).
    if (shape?.elementData?.isLineCircle) return null
    if (!activeGroup || shape !== activeGroup) {
        const id = shape?.elementData?.id
        return typeof id === 'string' && !shape.elementData.isGroupSelector
            ? id
            : null
    }

    const memberCopies = new Map<string, string>()
    activeGroup.children?.forEach((c: ShapeLike) => {
        if (c?.elementData?.id) memberCopies.set(c.id, c.elementData.id)
    })
    const sceneById = new Map<string, ShapeLike>()
    two.scene.children.forEach((c: ShapeLike) => {
        if (c?.elementData?.id && c !== activeGroup) sceneById.set(c.id, c)
    })

    const hits = document.elementsFromPoint(clientX, clientY)
    for (const hit of hits) {
        for (
            let node: Element | null = hit;
            node && node.tagName !== 'svg';
            node = node.parentElement
        ) {
            const memberId = memberCopies.get(node.id)
            if (memberId) return memberId
            const sceneEl = sceneById.get(node.id)
            if (sceneEl && !sceneEl.elementData.isGroupSelector) {
                return sceneEl.elementData.id
            }
        }
    }
    return null
}

// Toggle `clickedId` in the current selection.
export function toggleSelection(
    current: string[],
    clickedId: string
): string[] {
    return current.includes(clickedId)
        ? current.filter((id) => id !== clickedId)
        : [...current, clickedId]
}

export interface SurfaceBounds {
    left: number
    right: number
    top: number
    bottom: number
    width: number
    height: number
}

// Union of the members' on-screen boxes, padded and converted to surface
// coords. Reads the rendered SVG node, so rotation and stroke are included.
export function memberSurfaceBounds(
    ids: string[],
    two: TwoLike,
    toSurface: (p: { clientX: number; clientY: number }) => {
        x: number
        y: number
    }
): SurfaceBounds | null {
    const idSet = new Set(ids)
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    two.scene.children.forEach((c: ShapeLike) => {
        if (!idSet.has(c?.elementData?.id)) return
        const elem = c._renderer?.elem as SVGGraphicsElement | undefined
        if (!elem) return
        const r = elem.getBoundingClientRect()
        if (r.width === 0 && r.height === 0) return
        minX = Math.min(minX, r.left)
        minY = Math.min(minY, r.top)
        maxX = Math.max(maxX, r.right)
        maxY = Math.max(maxY, r.bottom)
    })
    if (!Number.isFinite(minX)) return null

    const tl = toSurface({
        clientX: minX - GROUP_BOUNDS_PAD_PX,
        clientY: minY - GROUP_BOUNDS_PAD_PX,
    })
    const br = toSurface({
        clientX: maxX + GROUP_BOUNDS_PAD_PX,
        clientY: maxY + GROUP_BOUNDS_PAD_PX,
    })
    return {
        left: tl.x,
        right: br.x,
        top: tl.y,
        bottom: br.y,
        width: br.x - tl.x,
        height: br.y - tl.y,
    }
}
