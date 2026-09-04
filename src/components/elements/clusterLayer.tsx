import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'

import { useBoardContext } from '../../views/Board/boardContext'
import type {
    Cluster,
    PointScreenInfo,
    CameraChangeEvent,
} from '../../types/board'

// Cluster scaffold + render layer (the HTML "cluster" marker variant).
//
// craftbase's canvas only knows the screen camera ({scale, tx, ty}), not
// real-world meters, so it can't decide "4 points within 100m" on its own. The
// actual grouping is delegated to the `clusterPoints` Board prop (e.g. craftmaps
// uses its map projection). This layer:
//   1. gathers every point's world + screen position,
//   2. hands them + the camera to `clusterPoints`,
//   3. renders a marker per returned cluster and hides the absorbed pins.
// With the flag off or no callback supplied it's a pure no-op — that's the
// "setup" the real 100m grouping (in craftmaps) plugs into.
//
// Recompute is driven by a requestAnimationFrame loop gated on a cheap camera +
// point-count signature, so it's idle until the camera moves or points change.

function setPointDisplay(id: string, display: string): void {
    const el = document.querySelector(
        `[data-component-id="${id}"]`
    ) as HTMLElement | null
    if (el) el.style.display = display
}

function ClusterLayer(): ReactElement | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = useBoardContext() as any
    const {
        pointClusteringEnabled,
        clusterPoints,
        twoJSInstance,
        stateRefForComponentStore,
    } = ctx

    const [clusters, setClusters] = useState<Cluster[]>([])
    const hiddenIdsRef = useRef<Set<string>>(new Set())
    const sigRef = useRef<string>('')

    const active =
        !!pointClusteringEnabled && typeof clusterPoints === 'function'

    useEffect(() => {
        const restoreAll = (): void => {
            hiddenIdsRef.current.forEach((id) => setPointDisplay(id, ''))
            hiddenIdsRef.current = new Set()
        }

        if (!active) {
            restoreAll()
            setClusters([])
            sigRef.current = ''
            return
        }

        let raf = 0
        const tick = (): void => {
            const scene = twoJSInstance?.scene
            if (scene) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const store = (stateRefForComponentStore?.current ?? {}) as Record<
                    string,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    any
                >
                const pointIds = Object.keys(store).filter(
                    (id) => store[id]?.componentType === 'point'
                )
                const camera: CameraChangeEvent = {
                    scale: scene.scale,
                    tx: scene.translation.x,
                    ty: scene.translation.y,
                }
                const sig = `${camera.scale}|${camera.tx}|${camera.ty}|${pointIds.length}`

                if (sig !== sigRef.current) {
                    sigRef.current = sig

                    const infos: PointScreenInfo[] = []
                    pointIds.forEach((id) => {
                        const rec = store[id]
                        if (!rec) return
                        const el = document.querySelector(
                            `[data-component-id="${id}"]`
                        )
                        if (!el) return
                        const r = el.getBoundingClientRect()
                        infos.push({
                            id,
                            x: rec.x,
                            y: rec.y,
                            screenX: r.left + r.width / 2,
                            screenY: r.top + r.height / 2,
                            category: rec.metadata?.category as
                                | string
                                | undefined,
                        })
                    })

                    const result: Cluster[] =
                        clusterPoints(infos, camera) || []

                    const nextHidden = new Set<string>()
                    result.forEach((c) =>
                        c.pointIds.forEach((pid) => nextHidden.add(pid))
                    )
                    // Restore pins no longer absorbed; hide newly absorbed ones.
                    hiddenIdsRef.current.forEach((pid) => {
                        if (!nextHidden.has(pid)) setPointDisplay(pid, '')
                    })
                    nextHidden.forEach((pid) => {
                        if (!hiddenIdsRef.current.has(pid))
                            setPointDisplay(pid, 'none')
                    })
                    hiddenIdsRef.current = nextHidden
                    setClusters(result)
                }
            }
            raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)

        return (): void => {
            cancelAnimationFrame(raf)
            restoreAll()
        }
    }, [active, clusterPoints, twoJSInstance, stateRefForComponentStore])

    if (!active || clusters.length === 0) return null

    return (
        <>
            {clusters.map((c) => {
                const warm = c.variant === 'warm'
                return (
                    <div
                        key={c.id}
                        className="fixed z-20 flex items-center justify-center rounded-full font-semibold select-none -translate-x-1/2 -translate-y-1/2"
                        style={{
                            left: c.screenX,
                            top: c.screenY,
                            width: 52,
                            height: 52,
                            background: warm ? '#C4901A' : '#1A1612',
                            color: warm ? '#1A1612' : '#E8C87A',
                            boxShadow: '3px 3px 0 #C4B89A',
                            fontSize: 15,
                            letterSpacing: '-0.03em',
                        }}
                    >
                        <span
                            className="absolute rounded-full"
                            style={{
                                inset: -5,
                                border: `1.5px solid ${
                                    warm ? '#E8C87A' : '#C4B89A'
                                }`,
                                opacity: 0.5,
                            }}
                        />
                        {c.count}
                    </div>
                )
            })}
        </>
    )
}

export default ClusterLayer
