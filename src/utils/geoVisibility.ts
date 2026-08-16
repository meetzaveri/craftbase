// Which elements are visible on which base.
//
// A base is a workspace, not just a backdrop: each one shows only the content
// that belongs on it. Geo objects (point / area / route / geoText) mean nothing
// without a map under them, and whiteboard shapes mean nothing floating over
// geography — so each set hides on the other's base.
//
// Text is the deliberate exception: it reads as an annotation on either
// substrate, so it stays visible throughout — except the first-visit welcome
// sketch, which is whiteboard onboarding and belongs to the board alone.
//
// This *hides*, it never deletes: records stay in the component store, the
// draft and the DB, so switching back brings everything straight back. It also
// toggles Two.js `visible` rather than unmounting element components, which
// avoids the `scene.subtractions` teardown hazard documented in CLAUDE.md and
// keeps switching cheap on a large board.

import { scheduleRender } from './renderScheduler'
import { isWelcomeComponent } from './welcomeSketch'
import { BASE_HIDDEN_FLAG, CULLED_FLAG } from './viewportCulling'
import type { BaseId } from '../bases/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwoLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any

/**
 * Whiteboard-only element types — hidden while a geographic base is active.
 * Note `text` is absent on purpose: plain text stays visible on every base.
 */
export const BOARD_ONLY_TYPES: ReadonlySet<string> = new Set([
    'rectangle',
    'circle',
    'diamond',
    'arrowLine',
    'curvedLine',
    'pencil',
    'line',
    'divider',
])

/** The fields the visibility rule reads off a component record. */
interface BaseVisibilityRecord {
    componentType?: string | null
    objectClass?: string | null
    metadata?: unknown
}

/**
 * Per-record override: `metadata.baseScope` pins one element to one base,
 * whatever its type would otherwise say. Returns null when unset.
 *
 * It exists because the type-level rules below can't express "this particular
 * text belongs to the board" — and text is exactly where that's needed, since
 * plain text is deliberately visible on every base. The welcome sketch is the
 * one writer today (see welcomeSketch.ts): its copy is whiteboard onboarding,
 * and it must stay board-only even after `promoteWelcomeSketch` strips the
 * `isWelcome` tag and turns it into the user's own content.
 *
 * Stored in `metadata` (a jsonb column), so it rides along to the draft, the
 * DB and exported JSON without a schema change.
 */
function scopedBase(
    record: BaseVisibilityRecord | null | undefined
): BaseId | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scope = (record?.metadata as any)?.baseScope
    return scope === 'board' || scope === 'map' ? scope : null
}

/**
 * Should a component *record* be visible on `base`? The rule itself, stated
 * once, over store data rather than Two.js elements.
 *
 * Anything that is neither geo nor board-only (text, groups, helpers) is left
 * alone — this returns true for those so they're never touched.
 *
 * Callers that scan the component store rather than the scene need exactly this
 * — the marquee hit-test in `newCanvas` being the notable one: it decides group
 * membership from store coordinates, so without this rule it would sweep up
 * elements belonging to the *other* base, which are on screen nowhere.
 */
export function isRecordVisibleOnBase(
    record: BaseVisibilityRecord | null | undefined,
    base: BaseId
): boolean {
    // An explicit per-record scope outranks every type-level rule below.
    const scope = scopedBase(record)
    if (scope) return scope === base

    // The first-visit welcome sketch is onboarding scaffolding for the
    // whiteboard — "draw a shape", pointing at the board's own toolbar. Its
    // shapes and arrow already hide as BOARD_ONLY_TYPES, but its headline is
    // standalone text, which is otherwise visible on every base; without this
    // a first-time visitor who tries the map switcher gets a stray line of
    // welcome copy floating over the world.
    //
    // Now redundant with the `baseScope` check above for sketches built by this
    // version — kept because it costs nothing and still covers a welcome record
    // that reached the store without going through `welcomeMetadata()`.
    if (isWelcomeComponent(record as never)) return base === 'board'
    if (record?.objectClass === 'geo') return base !== 'board'
    const type = record?.componentType
    if (typeof type === 'string' && BOARD_ONLY_TYPES.has(type)) {
        return base === 'board'
    }
    return true
}

/**
 * True for elements created by the geo toolset. `objectClass` is the canonical
 * marker (a real DB column) and correctly excludes `curvedLine`, which shares
 * the multi-click draw machinery but is a plain whiteboard line.
 */
export function isGeoElement(element: ShapeLike): boolean {
    return element?.elementData?.objectClass === 'geo'
}

/** True for the whiteboard shape/line/pencil family listed above. */
export function isBoardOnlyElement(element: ShapeLike): boolean {
    if (isGeoElement(element)) return false
    const type = element?.elementData?.componentType
    return typeof type === 'string' && BOARD_ONLY_TYPES.has(type)
}

/** Scene-element form of `isRecordVisibleOnBase` — same rule, one source. */
function isVisibleOn(element: ShapeLike, base: BaseId): boolean {
    return isRecordVisibleOnBase(element?.elementData, base)
}

/**
 * Apply the visibility rule for `base` to every element in the scene. Returns
 * how many elements actually changed, so callers can tell whether anything
 * needed doing.
 *
 * `forceGeoVisible` covers the deprecated `geoObjectsEnabled` consumer flag,
 * where geo objects live on a consumer-painted backdrop and must stay visible
 * regardless of craftbase's own base.
 */
export function applyBaseVisibility(
    two: TwoLike,
    base: BaseId,
    { forceGeoVisible = false }: { forceGeoVisible?: boolean } = {}
): number {
    // Array.from FIRST — two.scene.children is a Two.js Collection whose
    // .filter()/.map() construct a new Collection with a stray element. See
    // CLAUDE.md "Two.js Collection .filter() Pitfall".
    const children: ShapeLike[] = Array.from(two?.scene?.children ?? [])
    if (children.length === 0) return 0

    let changed = 0
    children.forEach((child) => {
        if (!child?.elementData) return
        const shouldShow =
            forceGeoVisible && isGeoElement(child)
                ? true
                : isVisibleOn(child, base)

        // This function is the sole authority on base-driven visibility, so it
        // publishes its verdict for the viewport culler — the other writer of
        // `visible` — to obey. Both flags are stamped on EVERY pass, including
        // the no-op early-return path below: an element already hidden by
        // culling still needs the base's verdict recorded, or the settle-time
        // `uncullViewport` will reveal it on a base it doesn't belong to.
        child[BASE_HIDDEN_FLAG] = !shouldShow
        // Whatever culling believed about this element is now stale — the base
        // just set `visible` from scratch.
        child[CULLED_FLAG] = false

        if (child.visible === shouldShow) return
        child.visible = shouldShow
        changed++
    })

    if (changed > 0) scheduleRender(two)
    return changed
}
