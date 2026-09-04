// Viewport culling — the lever against the pan/zoom PAINT cost on dense boards.
//
// Why it exists: craftbase elements are nested SVG groups (a shape is a <g> of
// ~4–9 nodes: fill path + hit-area path + text layer + endpoint handles). A
// 2000-element board is ~8600 SVG DOM nodes. Two.js's SVG renderer applies pan
// as a transform on the scene root, and the browser must re-rasterise every
// VISIBLE vector node each frame — so pan/zoom cost scales with how many
// elements sit inside the viewport, not with total scene size. At 10% zoom the
// whole board is on screen and every node repaints per frame; at 118% only a
// handful do (which is exactly why panning feels smooth zoomed-in and janky
// zoomed-out). Setting `visible = false` emits `display:none`, so the browser
// skips painting that subtree entirely.
//
// Scope: cull only DURING active motion, then unhide once the gesture settles
// (see `scheduleCullSettle`). At rest everything is visible, so export,
// fit-to-content, hit-testing and selection never observe a hidden element —
// which keeps this optimisation from colliding with any of those paths.

import { GROUP_COMPONENT } from '../constants/misc'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Two = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SceneChild = any

// Elements partially outside the viewport must NOT pop, so measure against a
// viewport expanded by this many screen px on every side.
const DEFAULT_MARGIN_PX = 300

// Marks an element hidden by culling (vs. genuinely hidden by undo/group
// bookkeeping), so `computeContentSurfaceBounds` still counts it as content.
export const CULLED_FLAG = '__cbCulled'

interface WorldBounds {
    tx: number
    ty: number
    left: number
    top: number
    right: number
    bottom: number
}

// Cache each element's world-space AABB, keyed by the object. World bounds are
// camera-independent (they only change when the element itself moves/resizes),
// so during a pan/zoom — where only the camera changes — every element is a
// cache hit and the per-frame work is pure arithmetic, no getBoundingClientRect.
const boundsCache = new WeakMap<SceneChild, WorldBounds>()

function worldBounds(child: SceneChild): WorldBounds | null {
    const cached = boundsCache.get(child)
    const tx = child.translation.x
    const ty = child.translation.y
    // Reuse unless the element moved. Resizes that keep the same origin are rare
    // and self-correct on the next move; a stale edge here only mis-culls an
    // element by its own size, well within DEFAULT_MARGIN_PX.
    if (cached && cached.tx === tx && cached.ty === ty) return cached

    let rect
    try {
        // Shallow = surface/world coords, independent of the live camera
        // (mirrors computeContentSurfaceBounds in newCanvas).
        rect = child.getBoundingClientRect(true)
    } catch {
        return null
    }
    if (!rect) return null
    const { left, top, right, bottom } = rect
    if (![left, top, right, bottom].every((n) => Number.isFinite(n))) return null

    const b: WorldBounds = { tx, ty, left, top, right, bottom }
    boundsCache.set(child, b)
    return b
}

function isCullable(child: SceneChild): boolean {
    const data = child?.elementData
    if (!data?.id) return false // selection chrome, welcome sketch, dummies
    if (data.componentType === GROUP_COMPONENT) return false // visibility is managed
    if (data.isDummy === true) return false
    return true
}

export interface CullStats {
    visible: number
    culled: number
    total: number
}

/**
 * Hide every cullable element whose screen bounds fall outside the viewport,
 * show the rest. Does NOT call two.update() — the caller batches the render
 * (the camera handlers already do, via scheduleRender). Returns counts for the
 * dev overlay.
 */
export function cullToViewport(
    two: Two,
    marginPx: number = DEFAULT_MARGIN_PX
): CullStats {
    const scene = two?.scene
    if (!scene) return { visible: 0, culled: 0, total: 0 }

    const scale = scene.scale || 1
    const tx = scene.translation.x
    const ty = scene.translation.y
    const vw = window.innerWidth
    const vh = window.innerHeight

    let visible = 0
    let culled = 0
    let total = 0

    for (const child of scene.children) {
        if (!isCullable(child)) continue
        total++

        const wb = worldBounds(child)
        if (!wb) {
            // Unmeasurable — never hide it (fail safe = painted).
            if (child.visible === false && child[CULLED_FLAG]) {
                child.visible = true
                child[CULLED_FLAG] = false
            }
            visible++
            continue
        }

        // World AABB → screen AABB.
        const sLeft = wb.left * scale + tx
        const sRight = wb.right * scale + tx
        const sTop = wb.top * scale + ty
        const sBottom = wb.bottom * scale + ty

        const onScreen =
            sRight > -marginPx &&
            sLeft < vw + marginPx &&
            sBottom > -marginPx &&
            sTop < vh + marginPx

        if (onScreen) {
            // Only un-hide elements WE hid — never override a genuine hide.
            if (child.visible === false && child[CULLED_FLAG]) {
                child.visible = true
                child[CULLED_FLAG] = false
            }
            visible++
        } else if (child.visible !== false) {
            child.visible = false
            child[CULLED_FLAG] = true
            culled++
        } else if (child[CULLED_FLAG]) {
            culled++
        }
    }

    return { visible, culled, total }
}

/**
 * Undo culling: reveal every element we hid (leaving genuinely-hidden ones
 * alone). Call when the gesture settles so at-rest state is fully painted.
 * Does NOT render — caller batches.
 */
export function uncullViewport(two: Two): void {
    const scene = two?.scene
    if (!scene) return
    for (const child of scene.children) {
        if (child[CULLED_FLAG]) {
            child.visible = true
            child[CULLED_FLAG] = false
        }
    }
}
