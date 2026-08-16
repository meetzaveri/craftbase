import React, { useEffect, useState, useRef } from 'react'
import type { ReactElement } from 'react'
import Two from 'two.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const factoryModules: Record<string, () => Promise<any>> = import.meta.glob(
    '../../factory/*.ts'
)
import { useBoardContext } from '../../views/Board/boardContext'
import getEditComponents from '../utils/editWrapper'
import { elementOnBlurHandler } from '../../utils/misc'
import { updateX1Y1Vertices, updateX2Y2Vertices } from '../../utils/updateVertices'
import { isStandaloneTextType } from '../../constants/misc'
import {
    applyCounterScaleToCopies,
    applyCounterScaleToCopy,
} from '../../utils/counterScale'

// PROTOTYPE FLAG — group resize. Flip to false to fully disable the corner
// resize handles + baking and fall back to the old move-only group overlay.
const GROUP_RESIZE_ENABLED = true
// Uniform scale never goes below this factor (avoids collapsing a group to 0).
const GROUP_RESIZE_MIN_SCALE = 0.1
// Floor for any scaled stroke width so lines never vanish.
const GROUP_RESIZE_MIN_STROKE = 0.5
// Corner resize-handle size in SCREEN px (radius). The handles live in surface
// space (children of the group), so their radius is counter-scaled by the
// camera zoom (and the live resize scale) to keep a constant, easily-grabbable
// size at ANY zoom — mirroring the single-element SelectionController handles.
const GROUP_HANDLE_SCREEN_RADIUS = 7
import {
    applyShapeText,
    getGroupFill,
    layoutStandaloneText,
    readOpacity,
    focusSvgElement,
} from '../../utils/canvasUtils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ElementProps = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any

// Child element factories load asynchronously, so group.add() can fire out of
// array order on first grouping. Re-sort the group's children by their stored
// z-order `position` (back→front) after every add so the within-group stacking
// always matches the canvas — independent of load timing. The transparent
// selector rectangle (no elementData) is pinned to the back. group.children
// .sort fires Two.js's 'order' event so the SVG <g> nodes physically reorder.
const orderGroupChildrenByZ = (group: ShapeLike): void => {
    group.children.sort((a: ShapeLike, b: ShapeLike) => {
        const aHas = !!a?.elementData
        const bHas = !!b?.elementData
        if (aHas !== bHas) return aHas ? 1 : -1
        const pa = Number.isFinite(a?.elementData?.position)
            ? a.elementData.position
            : 0
        const pb = Number.isFinite(b?.elementData?.position)
            ? b.elementData.position
            : 0
        if (pa !== pb) return pa - pb
        const ca = Number.isFinite(a?.elementData?.createdAt)
            ? a.elementData.createdAt
            : 0
        const cb = Number.isFinite(b?.elementData?.createdAt)
            ? b.elementData.createdAt
            : 0
        if (ca !== cb) return ca - cb
        return String(a?.elementData?.id ?? '').localeCompare(
            String(b?.elementData?.id ?? '')
        )
    })
}

function GroupedObjectWrapper(props: ElementProps): ReactElement {
    const {
        addToLocalComponentStore,
        updateComponentBulkPropertiesInLocalStore,
        deleteBulkComponentsFromLocalStore,
        recordBatchToHistoryLog,
        stateRefForComponentStore,
        isPencilMode,
        isArrowDrawMode,
        isArrowSelected,
        zuiInBoard,
    } = useBoardContext()

    const two = props.twoJSInstance
    const [deleteGroupElements, setDeleteGroupElements] =
        useState<ShapeLike>(null)
    const [groupId, setGroupId] = useState<string | null>(null)
    const isDeletingRef = useRef(false)
    // Active corner-resize gesture state (null when not resizing). Set on a
    // corner-handle mousedown, read/advanced on mousemove, consumed on mouseup.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resizeStateRef = useRef<any>(null)
    // Set by the mount effect; re-sizes the corner handles to a constant screen
    // size for a given effective scale. Called from the zoomChanged listener.
    const sizeHandlesRef = useRef<((effectiveScale: number) => void) | null>(
        null
    )
    // Last group position already written to history. commitGroupMove() compares
    // the live translation against this so a move is recorded exactly once,
    // whether the commit is triggered by drag-end (mouseup) or blur.
    const lastCommitPosRef = useRef<{ x: number; y: number } | null>(null)
    let groupInstance: ShapeLike = null
    let selectorInstance: ShapeLike = null

    function isInScene(element: ShapeLike): boolean {
        return element && two.scene.children.includes(element)
    }

    // Tear down just the transient overlay (resize box + member copies) and drop
    // the selection state — without touching the store. two.remove defers the
    // SVG detach to the next update; if that throws (scene.subtractions pitfall,
    // see CLAUDE.md) clear the stuck subtraction so future updates don't keep
    // retrying the broken removal.
    function dismissOverlayNode(): void {
        selectorInstance?.hide?.()
        window.dispatchEvent(new CustomEvent('groupBlurred'))
        try {
            two.remove([groupInstance])
            two.update()
        } catch (err) {
            console.warn('two.update() during group overlay teardown:', err)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const scene = two.scene as any
            scene.subtractions.length = 0
            scene._flagSubtractions = false
        }
    }

    // Restore the (group-level) opacity of our member elements — they were
    // hidden at 0 under the overlay. metadata may be a pencil vertex array, so
    // guard the `.opacity` read.
    function revealMembers(): void {
        const childrenIds = props.children.map((i: ShapeLike) => i.id)
        two.scene.children.forEach((element: ShapeLike) => {
            if (!element.elementData) return
            if (!childrenIds.includes(element.elementData.id)) return
            element.opacity = readOpacity(element.elementData)
        })
    }

    // Sync the (hidden) member elements to the overlay's current position and
    // record the move to history as ONE batch. Idempotent: if the group hasn't
    // moved since the last commit (lastCommitPosRef) it's a no-op, so calling it
    // on BOTH drag-end (mouseup) and blur never double-records. Committing on
    // drag-end is what makes a group move the last history entry — so undo
    // reverts the move even while the group is still selected, instead of
    // popping the previous action (e.g. a paste).
    function commitGroupMove(): void {
        if (isDeletingRef.current) return
        if (!groupInstance || !isInScene(groupInstance)) return

        const gx = parseInt(String(groupInstance.translation.x))
        const gy = parseInt(String(groupInstance.translation.y))
        const baseline = lastCommitPosRef.current
        if (
            baseline &&
            Math.abs(gx - baseline.x) < 0.5 &&
            Math.abs(gy - baseline.y) < 0.5
        ) {
            return
        }

        const userId = localStorage.getItem('userId')
        const childrenIds = props.children.map((i: ShapeLike) => i.id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const batchEntries: any[] = []

        two.scene.children.forEach((element: ShapeLike) => {
            if (!element.elementData) return
            if (!childrenIds.includes(element.elementData.id)) return

            let relativeData: ShapeLike = {}
            props.children.forEach((item: ShapeLike) => {
                if (item.id === element.elementData.id) relativeData = item
            })
            const prevTx = element.translation.x
            const prevTy = element.translation.y
            const newX = gx + parseInt(String(relativeData.x))
            const newY = gy + parseInt(String(relativeData.y))
            element.translation.x = newX
            element.translation.y = newY

            let newMetadata = element.elementData.metadata
            if (
                (element.elementData.componentType === 'pencil' ||
                    element.elementData.componentType === 'curvedLine') &&
                Array.isArray(element.elementData.metadata)
            ) {
                // A group move is a uniform translation: shift the ABSOLUTE
                // vertex array by the same delta as the element origin. Floats,
                // no per-vertex parseInt — truncating each vertex fed rounded
                // points into the factory's Chaikin smoothing on the next
                // rebuild and bent the stroke ("uneven" pasted/reloaded copies).
                // Don't rebuild the live anchors from metadata here either: the
                // factory already smoothed them (pencil Chaikin / curvedLine's
                // curve) and the translation above moves them, so re-deriving
                // from the raw simplified metadata would drop the smoothing and
                // render the stroke jagged.
                const dxMeta = newX - prevTx
                const dyMeta = newY - prevTy
                newMetadata = element.elementData.metadata.map(
                    (vert: ShapeLike) => ({
                        x: vert.x + dxMeta,
                        y: vert.y + dyMeta,
                        ...(vert.lw !== undefined ? { lw: vert.lw } : {}),
                    })
                )
            }

            const childId = element.elementData.id
            const current = (stateRefForComponentStore?.current?.[childId] ??
                {}) as ShapeLike
            const updateObj = {
                metadata: newMetadata,
                x: newX,
                y: newY,
                updatedBy: userId,
            }
            const positionChanged =
                current.x !== updateObj.x || current.y !== updateObj.y
            const metadataChanged = newMetadata !== current.metadata
            if (!positionChanged && !metadataChanged) return

            const prevProps = {
                metadata: current.metadata,
                x: current.x,
                y: current.y,
                updatedBy: current.updatedBy,
            }
            updateComponentBulkPropertiesInLocalStore(childId, updateObj, true)
            batchEntries.push({
                action: 'UPDATE_BULK',
                id: childId,
                prevProps,
                bulkObj: updateObj,
            })
        })

        if (batchEntries.length > 0) {
            recordBatchToHistoryLog(batchEntries)

            // The move relocated every member's ports (shapes) and endpoints
            // (arrows), but connectors that cross the group boundary weren't
            // translated with it: an outside arrow docked to a moved shape is
            // still at the old port, and a moved arrow docked to an outside
            // shape dragged its endpoint off that port. Announce every port
            // bound to/by a member so newCanvas re-glues + re-fans them (for
            // fully-internal connectors the restack is an idempotent no-op).
            const ports: { shapeId: string; edge: string }[] = []
            const seen = new Set<string>()
            const collect = (shapeId: unknown, edge: unknown): void => {
                if (typeof shapeId !== 'string' || typeof edge !== 'string') {
                    return
                }
                const key = `${shapeId}|${edge}`
                if (seen.has(key)) return
                seen.add(key)
                ports.push({ shapeId, edge })
            }
            const store = stateRefForComponentStore?.current ?? {}
            childrenIds.forEach((childId: string) => {
                const row = store[childId]
                if (!row) return
                if (row.componentType === 'arrowLine') {
                    collect(row.tailShapeId, row.tailEdge)
                    collect(row.headShapeId, row.headEdge)
                    return
                }
                Object.values(store).forEach((r: ShapeLike) => {
                    if (r?.componentType !== 'arrowLine') return
                    if (r.tailShapeId === childId) collect(childId, r.tailEdge)
                    if (r.headShapeId === childId) collect(childId, r.headEdge)
                })
            })
            if (ports.length) {
                window.dispatchEvent(
                    new CustomEvent('restackPorts', { detail: { ports } })
                )
            }
        }
        // Advance the baseline even if nothing recorded, so we don't re-scan on
        // every subsequent mouseup at the same position.
        lastCommitPosRef.current = { x: gx, y: gy }
        two.update()
    }

    function onBlurHandler(e: FocusEvent): void {
        elementOnBlurHandler(e, selectorInstance, two)
        window.dispatchEvent(new CustomEvent('groupBlurred'))
        if (!isDeletingRef.current) {
            // Commit any pending move FIRST so the (hidden) originals are synced
            // to the overlay's final position before we reveal them below.
            // Idempotent with the drag-end commit, so this won't double-record.
            commitGroupMove()

            const childrenIdsOfTheGroup = props.children.map(
                (item: ShapeLike) => item.id
            )
            let foundOriginalCount = 0
            two.scene.children.forEach((element: ShapeLike) => {
                if (!element.elementData) return
                if (childrenIdsOfTheGroup.includes(element.elementData.id)) {
                    foundOriginalCount++
                    // Reveal the (now position-synced) original: restore its own
                    // group-level opacity — it was hidden at 0 under the overlay.
                    element.opacity = readOpacity(element.elementData)
                }
            })
            two.update()

            if (foundOriginalCount === 0 && props.children.length > 0) {
                const gx = parseInt(String(groupInstance.translation.x))
                const gy = parseInt(String(groupInstance.translation.y))
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const batchEntries: any[] = []
                props.children.forEach((child: ShapeLike) => {
                    const localX = parseInt(
                        String(child.x ?? child.relativeX ?? 0)
                    )
                    const localY = parseInt(
                        String(child.y ?? child.relativeY ?? 0)
                    )
                    const absX = gx + localX
                    const absY = gy + localY

                    let childMetadata = child.metadata
                    // pencil + curvedLine store an absolute {x,y} vertex array;
                    // rebase it from the group's child space back to the
                    // standalone's absolute origin on materialize (else the
                    // dissolved member renders off-screen). (area/route share this
                    // shape but aren't grouped in practice — left as-is.)
                    if (
                        (child.componentType === 'pencil' ||
                            child.componentType === 'curvedLine') &&
                        Array.isArray(child.metadata)
                    ) {
                        childMetadata = child.metadata.map(
                            (vert: ShapeLike) => {
                                const lwProp =
                                    vert.lw !== undefined ? { lw: vert.lw } : {}
                                // Group-relative child vertex → absolute =
                                // group translation + vertex. Anchor every
                                // vertex (incl. the first) to its own group-
                                // relative coord, not the stored member origin
                                // (child.x), which can drift from metadata[0]
                                // for a vertex-edited curvedLine and would jump
                                // vertex 0 on ungroup.
                                return {
                                    x: gx + vert.x,
                                    y: gy + vert.y,
                                    ...lwProp,
                                }
                            }
                        )
                    }

                    const childData = {
                        ...child,
                        x: absX,
                        y: absY,
                        metadata: childMetadata,
                    }
                    addToLocalComponentStore(
                        child.id,
                        child.componentType,
                        childData,
                        true
                    )
                    batchEntries.push({ action: 'ADD', id: child.id })
                })
                recordBatchToHistoryLog(batchEntries)
            }
        }
        if (isInScene(groupInstance)) {
            two.remove([groupInstance])
            two.update()
        }
    }

    function onFocusHandler(): void {
        if (!groupInstance) return
        const el = document.getElementById(`${groupInstance.id}`)
        if (el) el.style.outline = '0'
        window.dispatchEvent(
            new CustomEvent('groupFocused', {
                detail: { group: groupInstance },
            })
        )
    }

    function onKeyDown(evt: KeyboardEvent): void {
        if (evt.keyCode === 8 || evt.keyCode === 46) {
            isDeletingRef.current = true
            setDeleteGroupElements(groupInstance.elementData)

            if (isInScene(groupInstance)) {
                two.remove([groupInstance])
            }
        }
    }

    const handleOnDeleteGroupElements = (): void => {
        if (deleteGroupElements?.id !== undefined) {
            const idsArr = deleteGroupElements.children.map(
                (item: ShapeLike) => item.id
            )

            // Synchronously remove children from the scene before React unmounts
            // them. See CLAUDE.md "Two.js scene.subtractions Pitfall" — the
            // try/catch + subtractions reset here is the canonical recovery
            // pattern.
            // Array.from FIRST: two.scene.children is a Two.js Collection
            // (Array subclass), so `.filter()` goes through ArraySpeciesCreate
            // → `new Collection(0)`, and that constructor treats a numeric
            // argument as an element to push. A filter matching nothing
            // therefore returns `[0]` with length 1 — which slipped past the
            // `length > 0` guard below and handed a bogus `0` to two.remove().
            const toRemove = Array.from(two.scene.children).filter(
                (el: ShapeLike) =>
                    el?.elementData && idsArr.includes(el.elementData.id)
            )
            if (toRemove.length > 0) {
                two.remove(toRemove)
                try {
                    two.update()
                } catch (err) {
                    console.warn(
                        'two.update() during group delete reconciliation:',
                        err
                    )
                    two.scene.subtractions.length = 0
                    two.scene._flagSubtractions = false
                }
            }

            deleteBulkComponentsFromLocalStore(idsArr)
            setDeleteGroupElements(null)
        }
    }

    useEffect(() => {
        if (deleteGroupElements !== null) {
            handleOnDeleteGroupElements()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deleteGroupElements])

    useEffect(() => {
        const onZoomChanged = (e: Event): void => {
            const detail = (e as CustomEvent<{ scale: number }>).detail
            if (!selectorInstance || !detail) return
            selectorInstance.setScale(detail.scale)
            // setScale re-sizes ALL selector circles to a small radius; re-apply
            // our larger constant-screen-size handles on top so they stay easy
            // to grab at the new zoom.
            sizeHandlesRef.current?.(detail.scale)
            // Member copies have no element component to counter-scale them on
            // zoom, so the overlay keeps the geo ones zoom-resistant itself.
            applyCounterScaleToCopies(groupInstance, detail.scale)
            two.update()
        }
        window.addEventListener('zoomChanged', onZoomChanged)
        return (): void =>
            window.removeEventListener('zoomChanged', onZoomChanged)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        const prevX = props.x
        const prevY = props.y

        const rectangle = two.makeRectangle(
            0,
            0,
            props?.width || 0,
            props?.height || 0
        )
        rectangle.fill = getGroupFill()
        rectangle.noStroke()

        const group = two.makeGroup(rectangle)
        group.elementData = {
            ...props?.itemData,
            children: props.children,
            isGroupSelector: true,
        }
        group.translation.x = parseInt(String(prevX)) || 500
        group.translation.y = parseInt(String(prevY)) || 200
        two.update()

        // Load every member's FACTORY chunk IN PARALLEL, then add them all +
        // hide the on-canvas originals in a SINGLE two.update() so the
        // group-select swap is atomic. Loading factories one-by-one and adding
        // members as each resolved (a per-child two.update each), while newCanvas
        // hid the originals up-front, left a blank frame (the flicker) between
        // "originals hidden" and "members painted". Factories are prefetched
        // (board.tsx warm list), so Promise.all resolves on the next microtask
        // on a warm cache.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const loaders = props.children.map((item: any) => {
            const factoryKey = `../../factory/${item.componentType}.ts`
            const loader = factoryModules[factoryKey]
            return typeof loader === 'function'
                ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  loader().then((mod: any) => ({ item, mod }))
                : Promise.resolve(null)
        })

        Promise.all(loaders).then((resolved) => {
            resolved.forEach((entry) => {
                if (!entry) return
                const { item, mod } = entry
                const componentFactory = new mod.default(two, item.x, item.y, {
                    ...item,
                })
                const factoryObject = componentFactory.createElement()
                const coreObject = factoryObject.group
                // Truncate the member origin the SAME way every original element
                // component does (`group.translation = parseInt(store.x)` in
                // rectangle/newText/pencil/arrow factories). Using the raw float
                // `item.x` here placed the copy at `store.x` while the original
                // renders at `trunc(store.x)` — a sub-pixel offset visible on any
                // element with fractional store coords (notably standalone text).
                // xMid (the group translation) is an integer, so this resolves to
                // exactly `parseInt(store.x)` in world space.
                coreObject.translation.x = parseInt(String(item.x))
                coreObject.translation.y = parseInt(String(item.y))
                coreObject.opacity = readOpacity(item)

                // Standalone text: the factory makes ONE Two.Text from the raw
                // content, but SVG collapses `\n` to a single line. Re-lay it out
                // as the stacked multiline block (same as the newText component)
                // so a grouped/duplicated text keeps its line breaks.
                if (isStandaloneTextType(item.componentType)) {
                    layoutStandaloneText(
                        two,
                        coreObject,
                        item.metadata?.content ?? '',
                        item.metadata?.fontSize || 36
                    )
                }

                // Shape-with-text (rectangle/diamond/circle): re-materialise the
                // embedded text the SAME way the shape components do on mount —
                // via `applyShapeText`, which reflows the raw content to the box
                // width and renders it as a stacked multiline text layer. The old
                // single `two.makeText(textContent)` collapsed `\n` into one line
                // (SVG <text> ignores newlines), so a grouped shape with multiline
                // text spilled out of its container. Mirrors the standalone-text
                // (`newText`) handling above.
                const meta = item.metadata || {}
                if (meta.hasText && meta.textContent) {
                    applyShapeText(
                        two,
                        coreObject,
                        item.componentType,
                        item.width || meta.width || 120,
                        meta
                    )
                }

                coreObject.elementData = item
                // Seed zoom-resistance on the copy from the current camera. The
                // originals get this from their own component; a copy is raw
                // factory output, so without it a grouped pin/geoText collapses
                // to world size for the life of the selection.
                applyCounterScaleToCopy(
                    coreObject,
                    item,
                    (zuiInBoard as ShapeLike)?.zui?.scale ?? two?.scene?.scale
                )
                group.add(coreObject)
            })
            orderGroupChildrenByZ(group)

            // Atomic swap: hide the on-canvas originals (group-SELECT only —
            // `membersToHide` is unset for paste) in the SAME update that
            // reveals the member copies, so there is never a blank frame.
            const hideIds: string[] = Array.isArray(props.membersToHide)
                ? props.membersToHide
                : []
            if (hideIds.length) {
                const hideSet = new Set(hideIds)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                two.scene.children.forEach((child: any) => {
                    if (hideSet.has(child?.elementData?.id)) child.opacity = 0
                })
            }

            two.update()
        })

        groupInstance = group

        const { selector } = getEditComponents(two, group, 4)
        selectorInstance = selector

        two.update()

        const groupEl = document.getElementById(group.id)
        if (groupEl) {
            groupEl.setAttribute('class', 'dragger-picker')
            groupEl.setAttribute('data-label', 'groupobject_coord')
            groupEl.dispatchEvent(new Event('mousedown'))
            groupEl.addEventListener('focus', onFocusHandler)
            groupEl.addEventListener('blur', onBlurHandler)
            groupEl.addEventListener('keydown', onKeyDown)
            focusSvgElement(groupEl)
        }

        // simulating click behavior
        selector.update(
            rectangle.getBoundingClientRect(true).left,
            rectangle.getBoundingClientRect(true).right,
            rectangle.getBoundingClientRect(true).top,
            rectangle.getBoundingClientRect(true).bottom,
            two.scene.scale
        )
        two.update()

        // Baseline for commitGroupMove — the group's initial position. A move
        // is only recorded once it diverges from this (then it advances).
        lastCommitPosRef.current = {
            x: parseInt(String(group.translation.x)),
            y: parseInt(String(group.translation.y)),
        }

        // ---- PROTOTYPE: group corner-resize ------------------------------
        // The group overlay's origin sits at the group CENTER with every member
        // positioned relative to it, so a single `group.scale` transform scales
        // member spacing, shape sizes AND stroke widths together — the exact
        // behavior we want. During the drag we apply that transform live; on
        // release we BAKE it into each real (hidden) member's Two.js object +
        // store (mirroring how history's applyBatch re-materialises a frozen
        // element), then dissolve the overlay to reveal the resized originals.
        const resizeCleanups: (() => void)[] = []

        // Map every absolute point through the uniform scale about the pinned
        // opposite corner O: P' = O + s·(P − O).
        const scaleAbout = (
            px: number,
            py: number,
            s: number,
            O: { x: number; y: number }
        ): { x: number; y: number } => ({
            x: O.x + s * (px - O.x),
            y: O.y + s * (py - O.y),
        })

        // Collect every port bound to/by a member so newCanvas re-glues the
        // connectors after the members move/resize (mirrors commitGroupMove).
        const restackMemberPorts = (childrenIds: string[]): void => {
            const store = stateRefForComponentStore?.current ?? {}
            const ports: { shapeId: string; edge: string }[] = []
            const seen = new Set<string>()
            const collect = (shapeId: unknown, edge: unknown): void => {
                if (typeof shapeId !== 'string' || typeof edge !== 'string')
                    return
                const key = `${shapeId}|${edge}`
                if (seen.has(key)) return
                seen.add(key)
                ports.push({ shapeId, edge })
            }
            childrenIds.forEach((childId) => {
                const row = store[childId]
                if (!row) return
                if (row.componentType === 'arrowLine') {
                    collect(row.tailShapeId, row.tailEdge)
                    collect(row.headShapeId, row.headEdge)
                    return
                }
                Object.values(store).forEach((r: ShapeLike) => {
                    if (r?.componentType !== 'arrowLine') return
                    if (r.tailShapeId === childId) collect(childId, r.tailEdge)
                    if (r.headShapeId === childId) collect(childId, r.headEdge)
                })
            })
            if (ports.length) {
                window.dispatchEvent(
                    new CustomEvent('restackPorts', { detail: { ports } })
                )
            }
        }

        // Bake a finished uniform scale `s` (anchored at surface point `O`) into
        // every real member: update the store, mutate the live Two.js object,
        // and record one BATCH of UPDATE_BULK entries so a single undo reverts
        // the whole resize.
        const bakeGroupResize = (s: number, O: { x: number; y: number }): void => {
            const userId = localStorage.getItem('userId')
            const childrenIds = props.children.map((i: ShapeLike) => i.id)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const batchEntries: any[] = []

            two.scene.children.forEach((element: ShapeLike) => {
                if (!element.elementData) return
                const id = element.elementData.id
                if (!childrenIds.includes(id)) return

                const ct = element.elementData.componentType
                const current = (stateRefForComponentStore?.current?.[id] ??
                    {}) as ShapeLike

                const curX = parseInt(
                    String(current.x ?? element.translation.x)
                )
                const curY = parseInt(
                    String(current.y ?? element.translation.y)
                )
                const origin = scaleAbout(curX, curY, s, O)
                const newX = Math.round(origin.x)
                const newY = Math.round(origin.y)

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const updateObj: any = { x: newX, y: newY, updatedBy: userId }
                if (current.width != null) {
                    updateObj.width = Math.max(1, Math.round(current.width * s))
                }
                if (current.height != null) {
                    updateObj.height = Math.max(
                        1,
                        Math.round(current.height * s)
                    )
                }
                if (current.linewidth != null) {
                    updateObj.linewidth = Math.max(
                        GROUP_RESIZE_MIN_STROKE,
                        current.linewidth * s
                    )
                }
                if (current.radius != null) {
                    updateObj.radius = current.radius * s
                }

                // arrow/line endpoints are local offsets → scale by s only.
                const isLineLike =
                    ct === 'arrowLine' || ct === 'line' || ct === 'divider'
                if (isLineLike) {
                    if (current.x1 != null) updateObj.x1 = current.x1 * s
                    if (current.y1 != null) updateObj.y1 = current.y1 * s
                    if (current.x2 != null) updateObj.x2 = current.x2 * s
                    if (current.y2 != null) updateObj.y2 = current.y2 * s
                }

                // pencil + curvedLine store an ABSOLUTE vertex array → scale
                // every vertex about O (and its per-vertex stroke width lw).
                let newMetadata = current.metadata
                if (
                    (ct === 'pencil' || ct === 'curvedLine') &&
                    Array.isArray(current.metadata)
                ) {
                    newMetadata = current.metadata.map((vert: ShapeLike) => {
                        const p = scaleAbout(vert.x, vert.y, s, O)
                        return {
                            x: p.x,
                            y: p.y,
                            ...(vert.lw !== undefined
                                ? {
                                      lw: Math.max(
                                          GROUP_RESIZE_MIN_STROKE,
                                          vert.lw * s
                                      ),
                                  }
                                : {}),
                        }
                    })
                    updateObj.metadata = newMetadata
                }

                // Shape-with-text + standalone text store their font size in an
                // OBJECT metadata bag. The group.scale transform grew the text
                // in transit, so scale the font too (and re-render below) —
                // otherwise the text snaps back to its original size on release.
                const objMeta =
                    current.metadata &&
                    typeof current.metadata === 'object' &&
                    !Array.isArray(current.metadata)
                        ? current.metadata
                        : null
                const isStandaloneText = isStandaloneTextType(ct)
                const hasShapeText =
                    !!objMeta?.hasText &&
                    typeof objMeta?.textContent === 'string'
                if (objMeta && hasShapeText) {
                    const oldSize = objMeta.textFontSize || 24
                    newMetadata = {
                        ...objMeta,
                        textFontSize: Math.max(4, Math.round(oldSize * s)),
                    }
                    updateObj.metadata = newMetadata
                } else if (objMeta && isStandaloneText) {
                    const oldSize = objMeta.fontSize || 36
                    newMetadata = {
                        ...objMeta,
                        fontSize: Math.max(4, Math.round(oldSize * s)),
                    }
                    updateObj.metadata = newMetadata
                }

                // ---- mutate the live (frozen) element, same contract as
                // history's applyBatch UPDATE_BULK branch ----
                element.translation.x = newX
                element.translation.y = newY
                const shape = element.children?.[0]
                if (shape) {
                    if (updateObj.width != null) shape.width = updateObj.width
                    if (updateObj.height != null) {
                        shape.height = updateObj.height
                    }
                    if (updateObj.linewidth != null) {
                        shape.linewidth = updateObj.linewidth
                    }
                }
                // Re-render text at the scaled font size. Shape-with-text reflows
                // to the new box width; standalone text re-stacks in place. Both
                // reuse the existing line nodes (same content ⇒ no add/remove),
                // so this stays in lockstep with the owning component.
                if (hasShapeText && newMetadata) {
                    applyShapeText(
                        two,
                        element,
                        ct,
                        updateObj.width ?? current.width ?? 120,
                        newMetadata
                    )
                } else if (isStandaloneText && newMetadata) {
                    layoutStandaloneText(
                        two,
                        element,
                        newMetadata.content ?? '',
                        newMetadata.fontSize || 36
                    )
                }
                if (isLineLike) {
                    const line = element.children?.[0]
                    const pc1 = element.children?.[1]
                    const pc2 = element.children?.[2]
                    if (line && pc1 && pc2 && line.vertices?.length >= 2) {
                        const x1 = updateObj.x1 ?? line.vertices[0].x
                        const y1 = updateObj.y1 ?? line.vertices[0].y
                        const x2 = updateObj.x2 ?? line.vertices[1].x
                        const y2 = updateObj.y2 ?? line.vertices[1].y
                        updateX1Y1Vertices(Two, line, x1, y1, pc1, two)
                        updateX2Y2Vertices(Two, line, x2, y2, pc2, two)
                        if (updateObj.linewidth != null) {
                            line.linewidth = updateObj.linewidth
                        }
                    }
                }
                if (ct === 'pencil' && Array.isArray(newMetadata)) {
                    const path = element.children?.[0]
                    if (path?.vertices) {
                        path.vertices = newMetadata.map(
                            (pt: ShapeLike) =>
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                new (Two as any).Anchor(
                                    pt.x - newX,
                                    pt.y - newY
                                )
                        )
                    }
                }
                if (ct === 'curvedLine' && Array.isArray(newMetadata)) {
                    element.elementData.metadata = newMetadata
                    window.dispatchEvent(
                        new CustomEvent('curvedLineVertsReverted', {
                            detail: { id, metadata: newMetadata },
                        })
                    )
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const prevProps: any = {}
                Object.keys(updateObj).forEach((k) => {
                    prevProps[k] = current[k]
                })
                updateComponentBulkPropertiesInLocalStore(id, updateObj, true)
                batchEntries.push({
                    action: 'UPDATE_BULK',
                    id,
                    prevProps,
                    bulkObj: updateObj,
                })
            })

            if (batchEntries.length > 0) {
                recordBatchToHistoryLog(batchEntries)
                restackMemberPorts(childrenIds)
            }
            two.update()
        }

        const onResizeMove = (e: MouseEvent): void => {
            const st = resizeStateRef.current
            if (!st || !isInScene(group)) return
            const curDist = Math.hypot(
                e.clientX - st.anchorScreen.x,
                e.clientY - st.anchorScreen.y
            )
            const s = Math.max(GROUP_RESIZE_MIN_SCALE, curDist / st.startDist)
            st.lastScale = s
            group.scale = s
            // Keep the opposite corner pinned: translation = C0 + (1−s)·d0.
            group.translation.x = st.C0.x + (1 - s) * st.d0.x
            group.translation.y = st.C0.y + (1 - s) * st.d0.y
            // The group scale would balloon the handles; counter-scale them by
            // camera zoom × live scale so they stay a constant screen size.
            sizeResizeHandles(two.scene.scale * s)
            two.update()
        }

        const onResizeUp = (): void => {
            window.removeEventListener('mousemove', onResizeMove, false)
            window.removeEventListener('mouseup', onResizeUp, false)
            const st = resizeStateRef.current
            resizeStateRef.current = null
            if (!st) return

            const s = st.lastScale ?? 1
            // Negligible drag — just undo the live transform, keep the overlay.
            if (Math.abs(s - 1) < 0.01) {
                group.scale = 1
                group.translation.x = st.C0.x
                group.translation.y = st.C0.y
                sizeResizeHandles(two.scene.scale)
                isDeletingRef.current = false
                two.update()
                return
            }

            // Clear the live transform BEFORE baking so member mutations write
            // clean (untransformed) coordinates, then commit + dissolve.
            group.scale = 1
            bakeGroupResize(s, st.O)
            revealMembers()
            selector?.hide?.()
            window.dispatchEvent(new CustomEvent('groupBlurred'))
            try {
                two.remove([group])
                two.update()
            } catch (err) {
                console.warn('two.update() during resize teardown:', err)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const scene = two.scene as any
                scene.subtractions.length = 0
                scene._flagSubtractions = false
            }
        }

        // Start a resize from corner `corner` (nw/ne/se/sw). We stopPropagation
        // so the group-MOVE drag (newCanvas delegation) never begins, and
        // preventDefault so the group keeps DOM focus (no blur → no dissolve).
        const beginGroupResize = (corner: string, e: MouseEvent): void => {
            if (!isInScene(group)) return
            e.preventDefault()
            e.stopPropagation()

            const halfW0 = (parseInt(String(props.width)) || 0) / 2
            const halfH0 = (parseInt(String(props.height)) || 0) / 2
            const sign: Record<string, [number, number]> = {
                nw: [-1, -1],
                ne: [1, -1],
                se: [1, 1],
                sw: [-1, 1],
            }
            const [sx, sy] = sign[corner] ?? [1, 1]
            // Opposite corner, in the group's local (== surface at scale 1)
            // frame: it is the pinned anchor for the whole gesture.
            const d0 = { x: -sx * halfW0, y: -sy * halfH0 }
            const C0 = {
                x: group.translation.x,
                y: group.translation.y,
            }
            const O = { x: C0.x + d0.x, y: C0.y + d0.y }

            // Screen-space anchor = the opposite corner circle's DOM center, so
            // the scale ratio is computed purely in client pixels (no surface
            // conversion needed here).
            const opposite: Record<string, ShapeLike> = {
                nw: selector.circle3,
                ne: selector.circle4,
                se: selector.circle1,
                sw: selector.circle2,
            }
            const oppElem = opposite[corner]?._renderer?.elem as
                | SVGElement
                | undefined
            const oppRect = oppElem?.getBoundingClientRect()
            const anchorScreen = oppRect
                ? {
                      x: oppRect.left + oppRect.width / 2,
                      y: oppRect.top + oppRect.height / 2,
                  }
                : { x: e.clientX, y: e.clientY }
            const startDist =
                Math.hypot(
                    e.clientX - anchorScreen.x,
                    e.clientY - anchorScreen.y
                ) || 1

            // Block the move-commit machinery for the duration of the resize.
            isDeletingRef.current = true
            resizeStateRef.current = {
                C0,
                d0,
                O,
                anchorScreen,
                startDist,
                lastScale: 1,
            }
            window.addEventListener('mousemove', onResizeMove, false)
            window.addEventListener('mouseup', onResizeUp, false)
        }

        // Counter-scale the 4 corner handles so they hold a constant screen
        // size — grabbable at low zoom without precise aim, like the single-
        // element handles. `effectiveScale` folds in the live resize scale so
        // they don't balloon while the group is being dragged.
        const cornerHandles = [
            selector.circle1,
            selector.circle2,
            selector.circle3,
            selector.circle4,
        ]
        const sizeResizeHandles = (effectiveScale: number): void => {
            const s = effectiveScale > 0 ? effectiveScale : 1
            const r = GROUP_HANDLE_SCREEN_RADIUS / s
            cornerHandles.forEach((c: ShapeLike) => {
                if (!c) return
                c.radius = r
                c.linewidth = 1.5 / s
            })
        }
        sizeHandlesRef.current = sizeResizeHandles

        // Wire the 4 corner circles as grab handles. They're children of the
        // group, so they track the corners automatically while it scales.
        if (GROUP_RESIZE_ENABLED) {
            const cornerCircles: { name: string; circle: ShapeLike }[] = [
                { name: 'nw', circle: selector.circle1 },
                { name: 'ne', circle: selector.circle2 },
                { name: 'se', circle: selector.circle3 },
                { name: 'sw', circle: selector.circle4 },
            ]
            const cursorFor: Record<string, string> = {
                nw: 'nwse-resize',
                se: 'nwse-resize',
                ne: 'nesw-resize',
                sw: 'nesw-resize',
            }
            cornerCircles.forEach(({ name, circle }) => {
                if (!circle) return
                // Clear, filled handle (cream fill, amber ring) so it reads as a
                // grab dot at any zoom.
                circle.fill = '#FFFCF5'
                circle.stroke = '#C4901A'
                const elem = circle._renderer?.elem as SVGElement | undefined
                if (!elem) return
                elem.style.cursor = cursorFor[name] ?? 'pointer'
                const onDown = (e: MouseEvent): void =>
                    beginGroupResize(name, e)
                elem.addEventListener('mousedown', onDown, false)
                resizeCleanups.push(() =>
                    elem.removeEventListener('mousedown', onDown, false)
                )
            })
            // Initial sizing to the current camera zoom (group not yet scaled).
            sizeResizeHandles(two.scene.scale)
            two.update()
        }

        setGroupId(group.id)

        return (): void => {
            resizeCleanups.forEach((fn) => fn())
            window.removeEventListener('mousemove', onResizeMove, false)
            window.removeEventListener('mouseup', onResizeUp, false)
            if (isInScene(group)) {
                two.remove(group)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Commit the move on drag-end so it lands in history immediately (like a
    // single shape's mouseup), making it the entry an undo reverts even while
    // the group stays selected. commitGroupMove is a no-op unless the group
    // actually moved, so this safely fires on every mouseup.
    useEffect(() => {
        const onMouseUp = (): void => commitGroupMove()
        window.addEventListener('mouseup', onMouseUp, false)
        return (): void =>
            window.removeEventListener('mouseup', onMouseUp, false)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Self-teardown when our members are removed out from under us — e.g. undo
    // of a paste, which fires 'elementRemoved' per member via the history
    // applyBatch. Without this the transient overlay (its member copies + the
    // resize box) would linger over now-deleted shapes as a stale selection.
    // We only dismiss the overlay here; the members are already being removed
    // by whoever fired the event, so we never touch the store. The group's own
    // Delete-key path sets isDeletingRef and owns its teardown, so we skip then.
    useEffect(() => {
        const memberIds = new Set(
            (props.children ?? []).map((c: ShapeLike) => c?.id).filter(Boolean)
        )
        const onMemberRemoved = ((e: CustomEvent<{ id: string }>): void => {
            if (isDeletingRef.current) return
            if (!memberIds.has(e.detail?.id)) return
            // Already torn down (a sibling member fired first) — nothing to do.
            if (!groupInstance || !isInScene(groupInstance)) return

            dismissOverlayNode()
            // The overlay has done its job; drop the listener so dead overlays
            // don't accumulate across repeated paste/undo cycles.
            window.removeEventListener('elementRemoved', onMemberRemoved)
        }) as EventListener
        window.addEventListener('elementRemoved', onMemberRemoved)
        return (): void =>
            window.removeEventListener('elementRemoved', onMemberRemoved)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // After an undo/redo, the overlay shows STATIC copies that can't reflect
    // members the history just moved/re-added underneath it (applyBatch touches
    // the real members, not the overlay's copies). Dismiss the overlay so the
    // user sees the real, now-updated members: reveal their opacity, then drop
    // the overlay. We don't commit here — the move was already reverted.
    useEffect(() => {
        const onHistoryApplied = (): void => {
            if (isDeletingRef.current) return
            if (!groupInstance || !isInScene(groupInstance)) return
            revealMembers()
            dismissOverlayNode()
        }
        window.addEventListener('historyApplied', onHistoryApplied)
        return (): void =>
            window.removeEventListener('historyApplied', onHistoryApplied)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        const el = groupId ? document.getElementById(groupId) : null
        if (el) {
            el.style.pointerEvents =
                isPencilMode || isArrowDrawMode || isArrowSelected
                    ? 'none'
                    : 'auto'
        }
    }, [isPencilMode, isArrowDrawMode, isArrowSelected, groupId])

    return <React.Fragment />
}

export default GroupedObjectWrapper
