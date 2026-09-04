import { useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { GROUP_COMPONENT, isStandaloneTextType } from '../constants/misc'
import { generateUUID } from '../utils/misc'
import {
    cloneElementData,
    getShapeTextNodes,
    pollUntilElement,
} from '../utils/canvasUtils'
import type { ComponentRecord, ComponentStore } from '../types/board'
import type { HistoryEntry } from './useComponentHistory'

// Two.js scene objects are typed loosely here; canvas-side typing converges
// in Stages 7–9.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwoLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ZuiInstanceLike = any

interface SingleClipboardPayload {
    kind: 'single'
    origin: { x: number; y: number }
    items: ComponentRecord[]
}

interface GroupClipboardPayload {
    kind: 'group'
    origin: { x: number; y: number }
    width?: number
    height?: number
    items: ComponentRecord[]
}

type ClipboardPayload = SingleClipboardPayload | GroupClipboardPayload

interface MousePosition {
    clientX: number
    clientY: number
    hasMoved: boolean
}

export interface CanvasClipboardOptions {
    twoJSInstance: TwoLike | null
    zuiInstanceRef: MutableRefObject<ZuiInstanceLike | null>
    boardId: string
    addToLocalComponentStore: (
        id: string,
        componentType: string,
        record: ComponentRecord,
        skipHistory?: boolean
    ) => void
    recordBatchToHistoryLog: (entries: HistoryEntry[]) => void
    renderGroupRef: MutableRefObject<
        ((groups: ComponentRecord[]) => void) | null
    >
    stateRefForComponentStore: MutableRefObject<ComponentStore | undefined>
}

export interface CanvasClipboardApi {
    clipboardRef: MutableRefObject<ClipboardPayload | null>
    lastMouseRef: MutableRefObject<MousePosition>
}

export function useCanvasClipboard({
    twoJSInstance,
    zuiInstanceRef,
    boardId,
    addToLocalComponentStore,
    recordBatchToHistoryLog,
    renderGroupRef,
    stateRefForComponentStore,
}: CanvasClipboardOptions): CanvasClipboardApi {
    const clipboardRef = useRef<ClipboardPayload | null>(null)
    const lastMouseRef = useRef<MousePosition>({
        clientX: 0,
        clientY: 0,
        hasMoved: false,
    })

    // Rebind a cloned arrow's port bindings so the paste stays attached:
    // a binding to a shape cloned in the SAME paste is remapped to the clone
    // (`idMap` old→new); a binding to a shape still on the canvas is kept
    // (the copy docks beside the original's connector — the fan spreads
    // them); a binding whose shape no longer exists is cleared. Returns the
    // ports the pasted arrow docks to, so the caller can request a restack
    // once the arrow has mounted (which glues its endpoints onto the ports).
    const rebindClonedArrow = (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cloned: any,
        idMap: Map<string, string>
    ): { shapeId: string; edge: string }[] => {
        const ports: { shapeId: string; edge: string }[] = []
        const store = stateRefForComponentStore.current
        ;(['tail', 'head'] as const).forEach((end) => {
            const shapeKey = `${end}ShapeId`
            const edgeKey = `${end}Edge`
            const indexKey = `${end}PortIndex`
            const boundId = cloned[shapeKey]
            const edge = cloned[edgeKey]
            if (typeof boundId !== 'string' || typeof edge !== 'string') return
            const mapped = idMap.get(boundId)
            if (mapped) {
                cloned[shapeKey] = mapped
                ports.push({ shapeId: mapped, edge })
            } else if (store?.[boundId]) {
                ports.push({ shapeId: boundId, edge })
            } else {
                cloned[shapeKey] = null
                cloned[edgeKey] = null
                cloned[indexKey] = 0
            }
        })
        return ports
    }

    // Once the pasted arrow is actually in the scene, ask newCanvas to
    // restack its docked ports — that recomputes fan indices AND glues the
    // pasted endpoints onto the ports. Must wait for the mount: a restack
    // that runs before the arrow exists would re-fan the port without it.
    const restackWhenMounted = (
        arrowId: string,
        ports: { shapeId: string; edge: string }[]
    ): void => {
        if (!ports.length || !twoJSInstance) return
        pollUntilElement(twoJSInstance, arrowId, () => {
            window.dispatchEvent(
                new CustomEvent('restackPorts', { detail: { ports } })
            )
        })
    }

    // Track cursor position so paste can land at mouse location
    useEffect(() => {
        const onMove = (e: MouseEvent): void => {
            lastMouseRef.current = {
                clientX: e.clientX,
                clientY: e.clientY,
                hasMoved: true,
            }
        }
        window.addEventListener('mousemove', onMove)
        return (): void => window.removeEventListener('mousemove', onMove)
    }, [])

    // Copy handler (Ctrl+C / Cmd+C)
    useEffect(() => {
        const onCopyEvent = (evt: KeyboardEvent): void => {
            if (evt.key !== 'c' || !(evt.ctrlKey || evt.metaKey)) return
            const tag = document.activeElement?.tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA') return

            const zuiInst = zuiInstanceRef.current
            const liveGroup = zuiInst?.getSelectedGroup?.()
            if (!liveGroup?.elementData?.id) return
            if (!twoJSInstance) return
            evt.preventDefault()

            const originX = liveGroup.translation.x
            const originY = liveGroup.translation.y
            const elementData = liveGroup.elementData

            let payload: ClipboardPayload
            if (elementData.componentType === GROUP_COMPONENT) {
                const children: ComponentRecord[] = Array.isArray(
                    elementData.children
                )
                    ? elementData.children
                    : []
                payload = {
                    kind: 'group',
                    origin: { x: originX, y: originY },
                    width: elementData.width,
                    height: elementData.height,
                    items: children.map((child) => ({ ...child })),
                }
            } else {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const item: any = {
                    ...elementData,
                    x: originX,
                    y: originY,
                    relativeX: 0,
                    relativeY: 0,
                }
                if (
                    elementData.componentType === 'arrowLine' ||
                    elementData.componentType === 'line'
                ) {
                    const line = liveGroup.children?.[0]
                    if (line?.vertices?.length >= 2) {
                        item.x1 = parseInt(String(line.vertices[0].x))
                        item.y1 = parseInt(String(line.vertices[0].y))
                        item.x2 = parseInt(String(line.vertices[1].x))
                        item.y2 = parseInt(String(line.vertices[1].y))
                    }
                }
                if (isStandaloneTextType(elementData.componentType)) {
                    // Multiline standalone text is a stack of Two.Text line
                    // nodes (line 1 + satellites) in the same group;
                    // children[0] alone is only line 1. Reconstruct the raw
                    // string from every line node so the clone keeps all
                    // lines.
                    const textNodes = getShapeTextNodes(liveGroup)
                    const firstNode = textNodes[0]
                    if (firstNode && typeof firstNode.value === 'string') {
                        // Prefer the STORED color (elementData) over the live
                        // node fill: in dark mode the node fill may be the
                        // display-swapped white (resolveTextDisplayFill), and we
                        // must not bake that into the copied component. Fall back
                        // to the node fill only for legacy items lacking a stored
                        // textColor.
                        item.textColor = item.textColor || firstNode.fill
                        item.metadata = {
                            ...item.metadata,
                            content: textNodes
                                .map((n) => n.value)
                                .join('\n'),
                            fontSize:
                                firstNode.size || item.metadata?.fontSize,
                            textFontFamily:
                                firstNode.family ||
                                item.metadata?.textFontFamily,
                        }
                    }
                }
                payload = {
                    kind: 'single',
                    origin: { x: originX, y: originY },
                    items: [item],
                }
            }
            clipboardRef.current = payload
        }
        window.addEventListener('keydown', onCopyEvent)
        return (): void => window.removeEventListener('keydown', onCopyEvent)
    }, [twoJSInstance, zuiInstanceRef])

    // Paste handler (Ctrl+V / Cmd+V)
    useEffect(() => {
        const onPasteEvent = (evt: KeyboardEvent): void => {
            if (evt.key !== 'v' || !(evt.ctrlKey || evt.metaKey)) return
            const tag = document.activeElement?.tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA') return

            const clipboard = clipboardRef.current
            if (!clipboard || !clipboard.items?.length) return

            const zuiInst = zuiInstanceRef.current
            if (!zuiInst?.zui) return
            evt.preventDefault()

            // Resolve paste origin. Fall back to viewport center if cursor hasn't moved.
            let clientX = lastMouseRef.current.clientX
            let clientY = lastMouseRef.current.clientY
            if (!lastMouseRef.current.hasMoved) {
                const rect = document
                    .getElementById('main-two-root')
                    ?.getBoundingClientRect()
                if (rect) {
                    clientX = rect.left + rect.width / 2
                    clientY = rect.top + rect.height / 2
                }
            }
            const surface = zuiInst.zui.clientToSurface(clientX, clientY)
            const px = surface.x
            const py = surface.y

            if (clipboard.kind === 'single') {
                const src = clipboard.items[0]
                if (!src) return
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const newItem: any = cloneElementData(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    src as any,
                    boardId,
                    px,
                    py
                )
                let arrowPorts: { shapeId: string; edge: string }[] = []
                if (
                    src.componentType === 'arrowLine' ||
                    src.componentType === 'line'
                ) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const s = src as any
                    const dx = (s.x2 ?? 0) - (s.x1 ?? 0)
                    const dy = (s.y2 ?? 0) - (s.y1 ?? 0)
                    newItem.x1 = 0
                    newItem.y1 = 0
                    newItem.x2 = dx
                    newItem.y2 = dy
                }
                if (src.componentType === 'arrowLine') {
                    // Keep the copy attached to whatever the original was
                    // docked to (no same-paste counterparts on a single copy).
                    // Plain lines never dock to ports, so this stays
                    // arrowLine-only.
                    arrowPorts = rebindClonedArrow(newItem, new Map())
                }
                if (
                    (src.componentType === 'pencil' ||
                        src.componentType === 'area' ||
                        src.componentType === 'route' ||
                        src.componentType === 'curvedLine') &&
                    Array.isArray(src.metadata)
                ) {
                    const dx = px - src.x
                    const dy = py - src.y
                    newItem.metadata = (
                        src.metadata as Array<{ x: number; y: number; lw?: number }>
                    ).map((pt) => {
                        const lwProp =
                            pt.lw !== undefined ? { lw: pt.lw } : {}
                        return { x: pt.x + dx, y: pt.y + dy, ...lwProp }
                    })
                }
                addToLocalComponentStore(
                    newItem.id,
                    newItem.componentType,
                    newItem
                )
                restackWhenMounted(newItem.id, arrowPorts)
                return
            }

            if (clipboard.kind === 'group') {
                // Map each source member's id to its clone's, so connectors
                // pasted alongside their bound shapes re-dock to the CLONES.
                const idMap = new Map<string, string>()
                const newChildren = clipboard.items.map((child) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const c = child as any
                    const rX = c.relativeX ?? 0
                    const rY = c.relativeY ?? 0
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const cloned: any = cloneElementData(
                        c,
                        boardId,
                        rX,
                        rY
                    )
                    cloned.relativeX = rX
                    cloned.relativeY = rY
                    if (typeof c.id === 'string') idMap.set(c.id, cloned.id)
                    return cloned
                })
                const arrowRestacks: {
                    arrowId: string
                    ports: { shapeId: string; edge: string }[]
                }[] = []
                newChildren.forEach((cloned) => {
                    if (cloned.componentType !== 'arrowLine') return
                    const ports = rebindClonedArrow(cloned, idMap)
                    if (ports.length) {
                        arrowRestacks.push({ arrowId: cloned.id, ports })
                    }
                })

                // Persist the pasted members to the store IMMEDIATELY, at
                // absolute coords (paste origin + each child's relative offset).
                // Previously the children were only written on the group's
                // blur-materialize (groupobject's foundOriginalCount===0 path),
                // which meant a reload while the pasted group was still selected
                // lost them — they lived only as transient overlay copies, never
                // in componentStore / the localStorage draft. Persisting here
                // makes paste reload-safe and lets the overlay below be a pure
                // selection over real standalones (see membersToHide), so blur
                // takes the restore-opacity path instead of re-materialising —
                // killing the teardown→async-rebuild flicker too.
                const memberIds: string[] = []
                // Record all member adds as ONE batch so a single undo removes
                // the whole pasted group (not one shape per press). We pass
                // skipHistory to addToLocalComponentStore and push an ADD entry
                // per child, then commit them together via recordBatchToHistoryLog.
                const pasteBatchEntries: HistoryEntry[] = []
                newChildren.forEach((child: ComponentRecord) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const c = child as any
                    const absX = px + (c.relativeX ?? 0)
                    const absY = py + (c.relativeY ?? 0)

                    // pencil / geo area / route keep their geometry as an
                    // absolute {x,y} vertex array in metadata — not in x/y. The
                    // group child stored it in the group's relative space, so
                    // rebase the whole array to the standalone's absolute origin
                    // (mirrors groupobject's blur-materialize). Without this the
                    // pasted stroke renders near the origin instead of under the
                    // group — i.e. "the pencil strokes disappear".
                    let memberMetadata = c.metadata
                    if (
                        (c.componentType === 'pencil' ||
                            c.componentType === 'area' ||
                            c.componentType === 'route' ||
                            c.componentType === 'curvedLine') &&
                        Array.isArray(c.metadata)
                    ) {
                        const meta = c.metadata as Array<{
                            x: number
                            y: number
                            lw?: number
                        }>
                        memberMetadata = meta.map((vert) => {
                            const lwProp =
                                vert.lw !== undefined ? { lw: vert.lw } : {}
                            // Group-relative child vertex → absolute at the
                            // paste origin (the new group origin). Anchor each
                            // vertex to its own group-relative coord, not the
                            // stored member origin (relativeX), which drifts
                            // from metadata[0] for a vertex-edited curvedLine
                            // and would jump vertex 0.
                            return {
                                x: px + vert.x,
                                y: py + vert.y,
                                ...lwProp,
                            }
                        })
                    }

                    const memberData = {
                        ...c,
                        x: absX,
                        y: absY,
                        metadata: memberMetadata,
                    }
                    memberIds.push(c.id)
                    addToLocalComponentStore(
                        c.id,
                        c.componentType,
                        memberData,
                        true
                    )
                    // The history entry's componentInfo must mirror the stored
                    // row: addToLocalComponentStore strips the transient
                    // relativeX/relativeY (not DB columns), so strip them here
                    // too — otherwise a redo in persisted mode would insert
                    // those non-schema fields and fail.
                    const {
                        relativeX: _rx,
                        relativeY: _ry,
                        ...storedShape
                    } = memberData
                    pasteBatchEntries.push({
                        action: 'ADD',
                        id: c.id,
                        componentInfo: storedShape as ComponentRecord,
                    })
                })
                if (pasteBatchEntries.length > 0) {
                    recordBatchToHistoryLog(pasteBatchEntries)
                }

                // Glue every pasted connector's docked endpoints onto their
                // (possibly remapped) ports once the arrows mount.
                arrowRestacks.forEach(({ arrowId, ports }) =>
                    restackWhenMounted(arrowId, ports)
                )

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const newGroup: any = {
                    id: generateUUID(),
                    boardId,
                    componentType: GROUP_COMPONENT,
                    x: px,
                    y: py,
                    width: clipboard.width,
                    height: clipboard.height,
                    fill: null,
                    stroke: null,
                    children: newChildren,
                    // Hide the just-persisted standalones beneath the overlay in
                    // the same update that paints the group's copies (atomic
                    // swap — see groupobject.tsx). Because the standalones now
                    // exist in the scene, the group's blur handler takes the
                    // restore-opacity path (foundOriginalCount > 0) rather than
                    // re-materialising them: no double-write, no flicker.
                    membersToHide: memberIds,
                }

                // Standalones mount asynchronously (React.lazy). Wait until the
                // last one is in the scene before rendering the overlay so the
                // group's atomic hide finds them — no brief double-paint of a
                // standalone plus its overlay copy. Falls back to immediate
                // render if there's nothing to wait on.
                const lastId = memberIds[memberIds.length - 1]
                if (lastId && twoJSInstance) {
                    pollUntilElement(twoJSInstance, lastId, () => {
                        renderGroupRef.current?.([newGroup])
                    })
                } else {
                    renderGroupRef.current?.([newGroup])
                }
            }
        }
        window.addEventListener('keydown', onPasteEvent)
        return (): void => window.removeEventListener('keydown', onPasteEvent)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [boardId, addToLocalComponentStore])

    return { clipboardRef, lastMouseRef }
}
