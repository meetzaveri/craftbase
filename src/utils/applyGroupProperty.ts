import type { MutableRefObject } from 'react'
import { strokeTypeToDashes, clearDashesOnTwoJSShape } from './misc'
import {
    applyShapeText,
    layoutStandaloneText,
    shapeTextStyleFromMeta,
    readOpacity,
} from './canvasUtils'
import { resolveHeightForTextStyleChange } from './shapeTextFit'

// Bulk-apply a property to every child of the currently-focused group whose
// element type accepts that property. Element types that don't accept the
// property silently discard the change (Phase 1: no UI filtering — toolbar
// shows the union of all properties; this layer enforces what each child can
// actually receive).
//
// Per Phase 1 decisions:
//   - Defaults are NOT touched on group edits (caller doesn't bump them).
//   - No "mixed value" inspection — toolbar reads from defaults.
//   - textSize/textFontFamily on rectangles-with-text use a simple direct
//     write — no resize-on-grow logic from the single-element path.
//
// Mutates three places per child:
//   1. The hidden Two.js shape in two.scene.children (opacity=0 while group
//      is selected; becomes visible again on blur with the new properties).
//   2. The visible nested coreObject inside the group's Two.js Group (so the
//      user sees the change in real time while the group is still focused).
//      Requires groupobject.js to stamp `coreObject.elementData = item`.
//   3. The componentStore row via updateComponentBulkPropertiesInLocalStore.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwoLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SelectedGroupLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChildEntry = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ComponentRow = Record<string, any>

type GroupPropertyKey =
    | 'fill'
    | 'stroke'
    | 'linewidth'
    | 'strokeType'
    | 'opacity'
    | 'textColor'
    | 'textSize'
    | 'textFontFamily'

interface HistoryBatchEntry {
    action: 'UPDATE_BULK'
    id: string
    prevProps: Partial<ComponentRow>
    bulkObj: Partial<ComponentRow>
}

export interface ApplyGroupPropertyDeps {
    selectedGroup: SelectedGroupLike | null
    twoJSInstance: TwoLike | null
    updateComponentBulkPropertiesInLocalStore: (
        id: string,
        bulkObj: Partial<ComponentRow>,
        skipDbWrite?: boolean
    ) => void
    stateRefForComponentStore?: MutableRefObject<Record<string, ComponentRow>>
    recordBatchToHistoryLog?: (entries: HistoryBatchEntry[]) => void
}

const ACCEPTS: Record<GroupPropertyKey, Set<string>> = {
    // Standalone text (newText/geoText) has no background-fill concept — its
    // color is `textColor`. Excluded so a group fill leaves text untouched and
    // never stamps a spurious `fill` onto a text row.
    fill: new Set(['rectangle', 'circle', 'diamond', 'frame']),
    stroke: new Set([
        'rectangle',
        'circle',
        'diamond',
        'frame',
        'arrowLine',
        'pencil',
    ]),
    linewidth: new Set([
        'rectangle',
        'circle',
        'diamond',
        'frame',
        'arrowLine',
        'pencil',
    ]),
    strokeType: new Set([
        'rectangle',
        'circle',
        'diamond',
        'frame',
        'arrowLine',
        'divider',
        'pencil',
    ]),
    // Pencil's metadata IS its vertex array, so opacity can't live in
    // `metadata.opacity` like every other type (it would clobber the points).
    // Pencil therefore persists opacity in a top-level `opacity` field instead
    // — see the pencil branch in the opacity handler below.
    opacity: new Set([
        'rectangle',
        'circle',
        'diamond',
        'frame',
        'arrowLine',
        'newText',
        'geoText',
        'pencil',
    ]),
    // rectangle, diamond AND circle all carry text the same way (see
    // applyShapeText / the *-with-text components), so a group text edit
    // must reach every one of them.
    textColor: new Set([
        'newText',
        'geoText',
        'rectangle',
        'diamond',
        'circle',
    ]),
    textSize: new Set(['newText', 'geoText', 'rectangle', 'diamond', 'circle']),
    textFontFamily: new Set([
        'newText',
        'geoText',
        'rectangle',
        'diamond',
        'circle',
    ]),
}

function findSceneElement(two: TwoLike, id: string): ShapeLike | undefined {
    return two?.scene?.children?.find(
        (c: ShapeLike) => c?.elementData?.id === id
    )
}

function findVisibleCoreObject(
    group: SelectedGroupLike,
    id: string
): ShapeLike | null {
    if (!group?.children) return null
    for (let i = 0; i < group.children.length; i++) {
        const c = group.children[i]
        if (c?.elementData?.id === id) return c
    }
    return null
}

// Collect every Two.Text line node inside `obj`, recursing through the
// text-layer sub-group (multiline text is a stack of nodes). Replaces the
// old single-node finder so group text edits reach every visible line.
function findTextNodesInside(obj: ShapeLike): ShapeLike[] {
    if (!obj?.children) return []
    const out: ShapeLike[] = []
    for (let i = 0; i < obj.children.length; i++) {
        const c = obj.children[i]
        if (typeof c?.value === 'string') out.push(c)
        else if (Array.isArray(c?.children)) out.push(...findTextNodesInside(c))
    }
    return out
}

// Recursively apply a dash pattern to every Path leaf inside `node`, skipping
// Two.js Group containers (descended into) and Text nodes (a dash pattern on
// glyph outlines is wrong, and consistent with the fill/stroke/linewidth
// handling that leaves the text node untouched). Used by the strokeType branch
// instead of `applyToTwoShape`: Two.js Group has no `dashes` setter (unlike
// fill/stroke/linewidth — group.js:1168-1216), so writing `group.dashes` is a
// dead own-property assignment that never reaches the child Paths.
function applyDashesToLeaves(
    node: ShapeLike,
    dashes: number[],
    clearSolid: boolean
): void {
    if (!node) return
    if (Array.isArray(node.children)) {
        for (let i = 0; i < node.children.length; i++) {
            applyDashesToLeaves(node.children[i], dashes, clearSolid)
        }
        return
    }
    if (typeof node.value === 'string') return
    node.dashes = dashes
    if (clearSolid) clearDashesOnTwoJSShape(node)
}

function applyToTwoShape(
    shape: ShapeLike,
    propertyKey: GroupPropertyKey,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any
): void {
    if (!shape) return
    if (propertyKey === 'fill') shape.fill = value
    else if (propertyKey === 'stroke') shape.stroke = value
    else if (propertyKey === 'linewidth') shape.linewidth = value
    else if (propertyKey === 'opacity') shape.opacity = value
}

export function createApplyGroupProperty(deps: ApplyGroupPropertyDeps) {
    return function applyGroupProperty(
        propertyKey: GroupPropertyKey | string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        value: any,
        // `preview` applies the change to the live Two.js scene only, skipping
        // the store/history writes — used for continuous slider drags. The final
        // value commits normally (no preview) on release.
        opts?: { preview?: boolean }
    ): void {
        const {
            selectedGroup,
            twoJSInstance,
            updateComponentBulkPropertiesInLocalStore,
            stateRefForComponentStore,
            recordBatchToHistoryLog,
        } = deps

        const children: ChildEntry[] | undefined =
            selectedGroup?.elementData?.children
        if (!Array.isArray(children) || children.length === 0) return

        const acceptSet = ACCEPTS[propertyKey as GroupPropertyKey]
        if (!acceptSet) return

        const batchEntries: HistoryBatchEntry[] = []

        const snapshotPrev = (
            id: string,
            keys: string[]
        ): Partial<ComponentRow> => {
            const current = stateRefForComponentStore?.current?.[id] ?? {}
            const prev: Partial<ComponentRow> = {}
            keys.forEach((k) => {
                let v = current[k]
                // Opacity is unset until first edited; its effective prior value
                // is fully opaque (or a legacy metadata.opacity). Capture that so
                // undo of the first opacity change restores it.
                if (v === undefined && k === 'opacity') v = readOpacity(current)
                if (v !== undefined) prev[k] = v
            })
            return prev
        }
        const recordChild = (
            id: string,
            bulkObj: Partial<ComponentRow>
        ): void => {
            const prevProps = snapshotPrev(id, Object.keys(bulkObj))
            batchEntries.push({
                action: 'UPDATE_BULK',
                id,
                prevProps,
                bulkObj,
            })
            updateComponentBulkPropertiesInLocalStore(id, bulkObj, true)
        }

        children.forEach((child) => {
            const type = child?.componentType
            if (!type || !acceptSet.has(type)) return
            const id = child?.id
            if (!id) return

            const sceneEl = findSceneElement(twoJSInstance, id)
            const coreObj = findVisibleCoreObject(selectedGroup, id)

            if (
                propertyKey === 'fill' ||
                propertyKey === 'stroke' ||
                propertyKey === 'linewidth'
            ) {
                // Two.js Group.fill/stroke/linewidth setters propagate the
                // value to *every* child (see node_modules/two.js/src/
                // group.js — each setter loops `child[prop] = v`). For a
                // rectangle-with-text the text node is a child of the same
                // group, so a group-level write hits the text alongside the
                // rectangle: `fill` repaints the text and it vanishes,
                // `stroke` gives it an outline, `linewidth` thickens that
                // outline. Capture the text node's own value before the group
                // write and restore it after, so the shape changes but the
                // text is left untouched. (The single-element path in
                // rectangle.tsx and the `opacity` branch below already avoid
                // this by targeting the shape leaf, not the group.)
                const sceneTexts = findTextNodesInside(sceneEl)
                const coreTexts = findTextNodesInside(coreObj)
                const sceneTextValues = sceneTexts.map((t) => t?.[propertyKey])
                const coreTextValues = coreTexts.map((t) => t?.[propertyKey])

                applyToTwoShape(sceneEl, propertyKey, value)
                applyToTwoShape(coreObj, propertyKey, value)

                // Restore every line node's own value the group write clobbered.
                sceneTexts.forEach((t, i) => {
                    if (sceneTextValues[i] !== undefined)
                        t[propertyKey] = sceneTextValues[i]
                })
                coreTexts.forEach((t, i) => {
                    if (coreTextValues[i] !== undefined)
                        t[propertyKey] = coreTextValues[i]
                })

                if (sceneEl?.elementData)
                    sceneEl.elementData[propertyKey] = value
                child[propertyKey] = value
                recordChild(id, { [propertyKey]: value })
                return
            }

            if (propertyKey === 'strokeType') {
                const dbValue = value === 'solid' ? 'solid' : value
                const dashes = strokeTypeToDashes(value)
                const clearSolid = value === 'solid'
                applyDashesToLeaves(sceneEl, dashes, clearSolid)
                applyDashesToLeaves(coreObj, dashes, clearSolid)
                if (sceneEl?.elementData)
                    sceneEl.elementData.strokeType = dbValue
                child.strokeType = dbValue
                recordChild(id, { strokeType: dbValue })
                return
            }

            if (propertyKey === 'opacity') {
                // Apply at GROUP level (mirrors the single-element path) so the
                // value can't compound with the group-level opacity that
                // revealMembers restores when the group is dismissed. The old
                // code pre-staged the value on the hidden original's LEAF, then
                // reveal set the GROUP opacity to the same value — leaf × group
                // = value² (a 50% edit rendered as 25% after ungrouping). The
                // hidden original stays hidden (its group opacity is 0 under the
                // overlay); we only normalise its leaf/text to 1 so the value
                // reveal sets later is exact. The visible overlay copy is dimmed
                // at its own group level so the user sees the change live.
                const sceneLeaf = sceneEl?.children?.[0]
                if (sceneLeaf) sceneLeaf.opacity = 1
                findTextNodesInside(sceneEl).forEach((t) => (t.opacity = 1))
                if (coreObj) {
                    coreObj.opacity = value
                    const coreLeaf = coreObj?.children?.[0]
                    if (coreLeaf) coreLeaf.opacity = 1
                    findTextNodesInside(coreObj).forEach((t) => (t.opacity = 1))
                }
                // Live drag preview: scene only, defer the store/history write
                // to the commit on release.
                if (opts?.preview) return
                // Opacity persists in the top-level `opacity` column for every
                // element type (unified — pencil's metadata is its vertex array
                // and the rest were migrated off metadata.opacity).
                if (sceneEl?.elementData) sceneEl.elementData.opacity = value
                child.opacity = value
                recordChild(id, { opacity: value })
                return
            }

            if (propertyKey === 'textColor') {
                if (type === 'newText' || type === 'geoText') {
                    const sceneTexts = sceneEl
                        ? findTextNodesInside(sceneEl)
                        : []
                    const coreTexts = coreObj
                        ? findTextNodesInside(coreObj)
                        : []
                    sceneTexts.forEach((t) => (t.fill = value))
                    coreTexts.forEach((t) => (t.fill = value))
                    if (sceneEl?.elementData)
                        sceneEl.elementData.textColor = value
                    child.textColor = value
                    recordChild(id, { textColor: value })
                } else if (
                    type === 'rectangle' ||
                    type === 'diamond' ||
                    type === 'circle'
                ) {
                    const sceneTexts = sceneEl
                        ? findTextNodesInside(sceneEl)
                        : []
                    const coreTexts = coreObj
                        ? findTextNodesInside(coreObj)
                        : []
                    if (
                        sceneTexts.length === 0 &&
                        coreTexts.length === 0 &&
                        !child?.metadata?.hasText
                    ) {
                        return
                    }
                    sceneTexts.forEach((t) => (t.fill = value))
                    coreTexts.forEach((t) => (t.fill = value))
                    const existingMeta =
                        sceneEl?.elementData?.metadata &&
                        !Array.isArray(sceneEl.elementData.metadata)
                            ? sceneEl.elementData.metadata
                            : (child?.metadata ?? {})
                    const updatedMeta = { ...existingMeta, textFill: value }
                    if (sceneEl?.elementData)
                        sceneEl.elementData.metadata = updatedMeta
                    child.metadata = updatedMeta
                    recordChild(id, {
                        metadata: updatedMeta,
                        textColor: value,
                    })
                }
                return
            }

            if (
                propertyKey === 'textSize' ||
                propertyKey === 'textFontFamily'
            ) {
                const sceneTexts = sceneEl ? findTextNodesInside(sceneEl) : []
                const coreTexts = coreObj ? findTextNodesInside(coreObj) : []
                const metaKey =
                    propertyKey === 'textSize'
                        ? 'textFontSize'
                        : 'textFontFamily'
                const twoKey = propertyKey === 'textSize' ? 'size' : 'family'
                const existingMeta =
                    sceneEl?.elementData?.metadata &&
                    !Array.isArray(sceneEl.elementData.metadata)
                        ? sceneEl.elementData.metadata
                        : child?.metadata && !Array.isArray(child.metadata)
                          ? child.metadata
                          : {}
                const updatedMeta = { ...existingMeta, [metaKey]: value }

                if (type === 'newText' || type === 'geoText') {
                    // Standalone text has no container box to fit — just restyle
                    // every line node. A size change also changes the per-line
                    // vertical offset, so re-lay the stack out (matching how the
                    // newText component re-spaces its lines) to keep them from
                    // overlapping. Rebuild the content string from the live line
                    // nodes rather than trusting `metadata.content` (which can be
                    // absent) so the re-layout never collapses the text.
                    sceneTexts.forEach((t) => (t[twoKey] = value))
                    coreTexts.forEach((t) => (t[twoKey] = value))
                    if (propertyKey === 'textSize') {
                        const lineSource =
                            coreTexts.length > 0 ? coreTexts : sceneTexts
                        const content =
                            lineSource.length > 0
                                ? lineSource
                                      .map((n) => n.value ?? '')
                                      .join('\n')
                                : (updatedMeta.content ?? '')
                        if (sceneEl)
                            layoutStandaloneText(
                                twoJSInstance,
                                sceneEl,
                                content,
                                value
                            )
                        if (coreObj)
                            layoutStandaloneText(
                                twoJSInstance,
                                coreObj,
                                content,
                                value
                            )
                    }
                    if (sceneEl?.elementData)
                        sceneEl.elementData.metadata = updatedMeta
                    child.metadata = updatedMeta
                    recordChild(id, { metadata: updatedMeta })
                    return
                }

                // rectangle / diamond / circle with embedded text.
                if (
                    sceneTexts.length === 0 &&
                    coreTexts.length === 0 &&
                    !child?.metadata?.hasText
                ) {
                    return
                }

                // Reflow the embedded text to the shape's CURRENT (fixed) width
                // with the new size/family so it wraps inside the box instead of
                // spilling out — never widen the box. Widening would break the
                // group's relative horizontal spacing (shapes laid out side by
                // side would overlap). Then re-fit ONLY the height to the
                // reflowed block (`resolveHeightForTextStyleChange`), which
                // keeps every x-position untouched. This mirrors the single
                // element resize/reflow path (canvasUtils.applyShapeText +
                // shapeTextFit) instead of the old getBBox width-grow.
                const storeRow = stateRefForComponentStore?.current?.[id]
                const width =
                    storeRow?.width ??
                    child?.width ??
                    sceneEl?.children?.[0]?.width ??
                    coreObj?.children?.[0]?.width ??
                    120
                const currentH =
                    storeRow?.height ??
                    child?.height ??
                    sceneEl?.children?.[0]?.height ??
                    coreObj?.children?.[0]?.height ??
                    0

                if (sceneEl)
                    applyShapeText(
                        twoJSInstance,
                        sceneEl,
                        type,
                        width,
                        updatedMeta
                    )
                if (coreObj)
                    applyShapeText(
                        twoJSInstance,
                        coreObj,
                        type,
                        width,
                        updatedMeta
                    )

                const { font: nextFont } = shapeTextStyleFromMeta(updatedMeta)
                const { font: prevFont } = shapeTextStyleFromMeta(existingMeta)
                const newH = resolveHeightForTextStyleChange({
                    kind: type,
                    width,
                    rawText: updatedMeta.textContent ?? '',
                    prevFont,
                    nextFont,
                    currentHeight: currentH,
                })

                const bulkObj: Partial<ComponentRow> = { metadata: updatedMeta }
                if (newH !== currentH) {
                    const sceneRect = sceneEl?.children?.[0]
                    const coreRect = coreObj?.children?.[0]
                    if (sceneRect) sceneRect.height = newH
                    if (coreRect) coreRect.height = newH

                    // Anchor the TOP edge: the shape path + text layer are
                    // centered on the group origin, so changing `height` alone
                    // resizes symmetrically and moves the top edge (and with it
                    // the shape's visual y). Shift the group by half the height
                    // delta so the box only grows/shrinks downward and the top
                    // edge — the user's "y point" — stays put. The shape center
                    // moves by the same half-delta (down when growing, up when
                    // the new style reclaims height).
                    //
                    // Two coordinate spaces are in play: the scene element's
                    // translation + the store row are ABSOLUTE world y, while the
                    // group child entry's x/y are RELATIVE to the group center
                    // (see the group assembly in newCanvas — `item.x - xMid`).
                    // Shift each in its own space so a later drag-commit
                    // (commitGroupMove: `gy + child.y`) recomputes the same
                    // absolute position.
                    const dy = (newH - currentH) / 2
                    const prevAbsY = sceneEl?.translation?.y ?? storeRow?.y ?? 0
                    const newAbsY = prevAbsY + dy
                    if (sceneEl?.translation) sceneEl.translation.y = newAbsY
                    if (coreObj?.translation) coreObj.translation.y += dy

                    if (sceneEl?.elementData) {
                        sceneEl.elementData.height = newH
                        sceneEl.elementData.y = newAbsY
                    }
                    child.height = newH
                    if (typeof child.y === 'number') child.y += dy
                    else child.y = (child.relativeY ?? 0) + dy
                    if (typeof child.relativeY === 'number')
                        child.relativeY += dy
                    bulkObj.height = Math.round(newH)
                    bulkObj.y = Math.round(newAbsY)
                }
                if (sceneEl?.elementData)
                    sceneEl.elementData.metadata = updatedMeta
                child.metadata = updatedMeta
                recordChild(id, bulkObj)
                return
            }
        })

        if (batchEntries.length > 0) {
            recordBatchToHistoryLog?.(batchEntries)
        }

        twoJSInstance?.update()
    }
}
