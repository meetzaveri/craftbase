// Which elements are visible on which base type.
//
// A base is the workspace; its `type` is the substrate it is drawn on — board
// (whiteboard), map, or image. Each type shows only the content that belongs on
// it: geo objects (point / area / route / geoText) mean nothing without a map
// under them, and whiteboard shapes mean nothing floating over geography, so
// each set hides on the other's type.
//
// Text is the one family the type-level rules cannot decide, because the same
// `newText` type can legitimately be authored on more than one base type. It is
// therefore scoped per record: `metadata.baseTypeScope` records the type it was
// authored on, and that pin outranks every rule below. This is the mechanism
// that generalises — a future image base needs no new branch here.
//
// This *hides*, it never deletes: records stay in the component store, the
// draft and the DB, so switching back brings everything straight back. It also
// toggles Two.js `visible` rather than unmounting element components, which
// avoids the `scene.subtractions` teardown hazard documented in CLAUDE.md and
// keeps switching cheap on a large base.

import { scheduleRender } from './renderScheduler'
import { isWelcomeComponent } from './welcomeSketch'
import { BASE_TYPE_HIDDEN_FLAG, CULLED_FLAG } from './viewportCulling'
import { isBaseType } from '../baseTypes/registry'
import type { BaseType } from '../baseTypes/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwoLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any

/**
 * Whiteboard-only element types — hidden while a geographic base type is active.
 *
 * Text is absent on purpose, but NOT because it is universal: text is scoped
 * per-record via `metadata.baseTypeScope` (stamped at creation in base.tsx),
 * because the same `newText` type can be authored on more than one base type.
 * See the legacy-text rule in `isRecordVisibleOnBaseType` for records that
 * predate that stamp.
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
interface BaseTypeVisibilityRecord {
    componentType?: string | null
    objectClass?: string | null
    metadata?: unknown
}

/**
 * Per-record override: `metadata.baseTypeScope` pins one element to one base
 * type, whatever its componentType would otherwise say. Returns null when unset.
 *
 * It exists because the type-level rules below can't express "this particular
 * text belongs to the whiteboard" — and text is exactly where that's needed,
 * since `newText` is authorable on more than one base type. Two writers today:
 * `buildTextShapeData` (base.tsx) stamps the authoring type on every text
 * element, and `welcomeSketch.ts` pins the onboarding copy to the board base so
 * it stays board-only even after `promoteWelcomeSketch` strips the `isWelcome`
 * tag and turns it into the user's own content.
 *
 * Stored in `metadata` (a jsonb column), so it rides along to the draft, the
 * DB and exported JSON without a schema change.
 *
 * The legacy `baseScope` spelling is still read. Unlike the localStorage keys,
 * this field lives inside `metadata` on rows already persisted to Hasura, which
 * `storageMigration.ts` cannot reach — a promoted welcome sketch on a saved
 * base would otherwise lose its pin and resurface over the map. This is the
 * one deliberate back-compat read in the rename.
 */
function scopedBaseType(
    record: BaseTypeVisibilityRecord | null | undefined
): BaseType | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = record?.metadata as any
    const scope = meta?.baseTypeScope ?? meta?.baseScope
    return isBaseType(scope) ? scope : null
}

/**
 * Should a component *record* be visible on `baseType`? The rule itself, stated
 * once, over store data rather than Two.js elements.
 *
 * Anything no rule claims (groups, helpers) is left alone — this returns true
 * for those so they're never touched.
 *
 * Callers that scan the component store rather than the scene need exactly this
 * — the marquee hit-test in `newCanvas` being the notable one: it decides group
 * membership from store coordinates, so without this rule it would sweep up
 * elements belonging to the *other* baseType, which are on screen nowhere.
 */
export function isRecordVisibleOnBaseType(
    record: BaseTypeVisibilityRecord | null | undefined,
    baseType: BaseType
): boolean {
    // An explicit per-record scope outranks every type-level rule below.
    const scope = scopedBaseType(record)
    if (scope) return scope === baseType

    // The first-visit welcome sketch is onboarding scaffolding for the
    // whiteboard — "draw a shape", pointing at the board base's own toolbar.
    // Without this, a first-time visitor who tries the map switcher gets a
    // stray line of welcome copy floating over the world.
    //
    // Now doubly redundant — with the `baseTypeScope` check above for sketches
    // built by this version, and with the legacy-text rule below — but kept
    // because it costs nothing and still covers a welcome record that reached
    // the store without going through `welcomeMetadata()`.
    if (isWelcomeComponent(record as never)) return baseType === 'board'
    if (record?.objectClass === 'geo') return baseType !== 'board'
    const type = record?.componentType

    // Legacy text, authored before `baseTypeScope` was stamped at creation.
    //
    // Inferring 'board' here is sound rather than a guess: the text tool is in
    // GEO_HIDDEN_TOOLS, so `activeTextComponentType()` yields `geoText` on any
    // geographic base type. A bare `newText` record can therefore only ever
    // have been authored on the board base.
    //
    // This is NOT a claim that `newText` is a board-only *type* — that is why
    // it is a rule here rather than an entry in BOARD_ONLY_TYPES. Text authored
    // on a future image base will also be `newText`, and will carry an explicit
    // `baseTypeScope: 'image'`, which outranks this check.
    if (type === 'newText') return baseType === 'board'

    if (typeof type === 'string' && BOARD_ONLY_TYPES.has(type)) {
        return baseType === 'board'
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

/** Scene-element form of `isRecordVisibleOnBaseType` — same rule, one source. */
function isVisibleOn(element: ShapeLike, baseType: BaseType): boolean {
    return isRecordVisibleOnBaseType(element?.elementData, baseType)
}

/**
 * Apply the visibility rule for `baseType` to every element in the scene. Returns
 * how many elements actually changed, so callers can tell whether anything
 * needed doing.
 *
 * `forceGeoVisible` covers the deprecated `geoObjectsEnabled` consumer flag,
 * where geo objects live on a consumer-painted backdrop and must stay visible
 * regardless of craftbase's own base.
 */
export function applyBaseTypeVisibility(
    two: TwoLike,
    baseType: BaseType,
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
                : isVisibleOn(child, baseType)

        // This function is the sole authority on baseType-driven visibility, so it
        // publishes its verdict for the viewport culler — the other writer of
        // `visible` — to obey. Both flags are stamped on EVERY pass, including
        // the no-op early-return path below: an element already hidden by
        // culling still needs the baseType's verdict recorded, or the settle-time
        // `uncullViewport` will reveal it on a baseType it doesn't belong to.
        child[BASE_TYPE_HIDDEN_FLAG] = !shouldShow
        // Whatever culling believed about this element is now stale — the baseType
        // just set `visible` from scratch.
        child[CULLED_FLAG] = false

        if (child.visible === shouldShow) return
        child.visible = shouldShow
        changed++
    })

    if (changed > 0) scheduleRender(two)
    return changed
}
