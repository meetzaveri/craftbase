// Dev-only performance overlay for the canvas.
//
// Purpose: make the pan/zoom paint cost VISIBLE and let it be validated on a
// real GPU (headless Chromium can't reproduce it — it uses a software
// rasteriser). Shows live FPS, the worst frame gap over the last window (the
// stutter metric), the total element count, how many are currently
// viewport-culled, and the live zoom. Includes a viewport-culling toggle and a
// "seed N shapes" button so a dense board can be reproduced on demand.
//
// Reads the dev-only `window.__cbTwo` handle exposed by newCanvas. Rendered
// only under import.meta.env.DEV, so it ships in no production bundle.

import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { DRAFT_STORAGE_KEY } from '../../constants/misc'
import {
    getViewportCullingEnabled,
    setViewportCullingEnabled,
    subscribeViewportCullingEnabled,
} from '../../utils/featureFlags'
import { CULLED_FLAG } from '../../utils/viewportCulling'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Two = any

function getTwo(): Two | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).__cbTwo ?? null
}

// Count total content elements + how many are currently culled.
function countElements(two: Two): { total: number; culled: number } {
    let total = 0
    let culled = 0
    const scene = two?.scene
    if (!scene) return { total, culled }
    for (const child of scene.children) {
        if (!child?.elementData?.id) continue
        total++
        if (child[CULLED_FLAG]) culled++
    }
    return { total, culled }
}

// Seed N simple shapes into a local draft and reload — mirrors the real
// board-load path (draft restore), which is exactly the code we want to stress.
function seedShapes(n: number): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const components: Record<string, any> = {}
    const types = ['rectangle', 'circle', 'line']
    const spread = Math.ceil(Math.sqrt(n)) * 180
    for (let i = 0; i < n; i++) {
        const type = types[i % 3]
        const x = Math.round(Math.random() * spread - spread / 2)
        const y = Math.round(Math.random() * spread - spread / 2)
        const id = `perf-${i}-${Math.random().toString(36).slice(2, 8)}`
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const base: any = {
            id,
            componentType: type,
            x,
            y,
            width: 120,
            height: 120,
            fill: '#f4f4f2',
            stroke: '#1c1c1c',
            linewidth: 2,
            strokeType: 'solid',
            boardId: 'perf-board',
        }
        if (type === 'line') {
            base.x1 = x
            base.y1 = y
            base.x2 = x + 100
            base.y2 = y + 60
        }
        components[id] = base
    }
    localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
            boardId: 'perf-board',
            components,
            timestamp: Date.now(),
        })
    )
    window.location.reload()
}

const PerfOverlay = (): ReactElement => {
    const [fps, setFps] = useState(0)
    const [maxGap, setMaxGap] = useState(0)
    const [total, setTotal] = useState(0)
    const [culled, setCulled] = useState(0)
    // Stored as the raw scale multiplier and shown as "1.00×" (not "100%") so
    // the overlay never collides with the ZoomControls "N%" readout that e2e
    // asserts on via an exact-text match.
    const [zoom, setZoom] = useState(1)
    const [culling, setCulling] = useState(getViewportCullingEnabled())
    const [seedN, setSeedN] = useState(2000)

    // Frame-rate + worst-frame-gap sampler. One rAF loop; publishes to state
    // twice a second so React churn doesn't itself perturb the measurement.
    const frames = useRef(0)
    const windowMaxGap = useRef(0)
    const lastFrame = useRef(0)
    const lastPublish = useRef(performance.now())

    useEffect(() => {
        let raf = 0
        const tick = (t: number): void => {
            frames.current++
            if (lastFrame.current) {
                const gap = t - lastFrame.current
                if (gap > windowMaxGap.current) windowMaxGap.current = gap
            }
            lastFrame.current = t

            const now = performance.now()
            const elapsed = now - lastPublish.current
            if (elapsed >= 500) {
                setFps(Math.round((frames.current * 1000) / elapsed))
                setMaxGap(Math.round(windowMaxGap.current))
                const two = getTwo()
                if (two) {
                    const c = countElements(two)
                    setTotal(c.total)
                    setCulled(c.culled)
                    setZoom(two.scene.scale || 1)
                }
                frames.current = 0
                windowMaxGap.current = 0
                lastPublish.current = now
            }
            raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [])

    useEffect(() => subscribeViewportCullingEnabled(setCulling), [])

    const gapBad = maxGap > 20 // > ~1.2 frames == a dropped frame this window

    return (
        <div
            style={{
                position: 'fixed',
                top: 10,
                right: 10,
                zIndex: 10000,
                background: 'rgba(0,0,0,0.78)',
                color: '#fff',
                font: '12px/1.5 monospace',
                padding: '8px 10px',
                borderRadius: 8,
                minWidth: 190,
                pointerEvents: 'auto',
                userSelect: 'none',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>FPS</span>
                <strong style={{ color: fps >= 55 ? '#7CFC7C' : '#FFB84D' }}>
                    {fps}
                </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>worst frame</span>
                <strong style={{ color: gapBad ? '#FF7A7A' : '#7CFC7C' }}>
                    {maxGap}ms
                </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>zoom</span>
                <span>{zoom.toFixed(2)}×</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>elements</span>
                <span>{total}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>culled</span>
                <span>
                    {culled}
                    {total > 0 ? ` (${Math.round((culled / total) * 100)}%)` : ''}
                </span>
            </div>

            <label
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 8,
                    cursor: 'pointer',
                }}
            >
                <input
                    type="checkbox"
                    checked={culling}
                    onChange={(e) =>
                        setViewportCullingEnabled(e.target.checked)
                    }
                />
                viewport culling
            </label>

            <div
                style={{
                    display: 'flex',
                    gap: 4,
                    marginTop: 8,
                    alignItems: 'center',
                }}
            >
                <input
                    type="number"
                    value={seedN}
                    min={0}
                    step={500}
                    onChange={(e) => setSeedN(Number(e.target.value) || 0)}
                    style={{
                        width: 64,
                        background: '#222',
                        color: '#fff',
                        border: '1px solid #555',
                        borderRadius: 4,
                        padding: '2px 4px',
                        font: '12px monospace',
                    }}
                />
                <button
                    onClick={() => seedShapes(seedN)}
                    style={{
                        flex: 1,
                        background: '#3a3a3a',
                        color: '#fff',
                        border: '1px solid #666',
                        borderRadius: 4,
                        padding: '2px 6px',
                        cursor: 'pointer',
                        font: '12px monospace',
                    }}
                    title="Seed N test shapes into a local draft and reload"
                >
                    seed + reload
                </button>
            </div>
        </div>
    )
}

export default PerfOverlay
