// Keep small interaction handles a constant on-screen size at any zoom.
//
// Arrow/line endpoint circles and curved-line vertex dots live INSIDE the scene
// group, so by default they attenuate with the world — at 20% zoom a 5px handle
// renders at ~1px and is impossible to grab. Counter-scaling each handle by
// `1/scale` cancels the scene zoom exactly, holding its base radius in screen
// px. This mirrors how the selection box dots stay constant-size
// (selectionController uses Two.Points with sizeAttenuation off); here we do it
// per-shape so the handles can keep their individual DOM nodes (needed for the
// per-handle drag listeners).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { scheduleRender } from './renderScheduler'

type ShapeLike = any

// Set each handle's uniform scale to cancel the current camera zoom.
export function applyHandleCounterScale(
    handles: ShapeLike[],
    scale: number
): void {
    if (!Number.isFinite(scale) || scale <= 0) return
    const k = 1 / scale
    handles.forEach((h) => {
        if (h) h.scale = k
    })
}

// Keep a hit-area stroke a constant *screen* width at any zoom. Line/arrow/
// curved-line clickable areas are strokes measured in world units, so they
// shrink with the world — at 10% a 12px band becomes ~1.2px and is almost
// impossible to click. `apply(worldWidth)` receives `basePx / scale`, i.e. the
// world-unit stroke width that renders (and hit-tests) at a constant `basePx`
// on screen. Returns a cleanup that detaches the listener.
export function attachStrokeCounterScale(
    apply: (worldWidth: number) => void,
    basePx: number,
    two: ShapeLike,
    initialScale: number
): () => void {
    const set = (scale: number): void => {
        if (!Number.isFinite(scale) || scale <= 0) return
        apply(basePx / scale)
    }
    // Seed once at mount. Batched, NOT a direct two.update(): every line/arrow
    // seeds on mount, so a synchronous render here is one full O(scene) render
    // per element — O(N²) across a board load. scheduleRender coalesces them
    // all into a single render for the frame.
    set(initialScale || 1)
    scheduleRender(two)
    // On zoom, ONLY mutate — never call two.update() here. The camera's wheel
    // handler dispatches `zoomChanged` synchronously and then calls two.update()
    // exactly once, which paints every listener's mutation in a single render.
    // Calling two.update() per listener means N full-scene re-renders per wheel
    // tick (one per on-canvas line), which makes continuous zoom rigid/laggy.
    const onZoom = (e: Event): void => {
        const scale = (e as CustomEvent<{ scale: number }>).detail?.scale
        if (!scale) return
        set(scale)
    }
    window.addEventListener('zoomChanged', onZoom as EventListener)
    return (): void => {
        window.removeEventListener('zoomChanged', onZoom as EventListener)
    }
}

// Seed the handles from the current camera scale and keep them constant-size on
// every camera change. Reads `scale` off each `zoomChanged` event (no stale
// closure — see the React + Two.js note in CLAUDE.md). Returns a cleanup that
// detaches the listener.
export function attachHandleCounterScale(
    handles: ShapeLike[],
    two: ShapeLike,
    initialScale: number
): () => void {
    // Seed once at mount — batched for the same reason as above: one sync render
    // per mounting element is O(N²) across a board load.
    applyHandleCounterScale(handles, initialScale || 1)
    scheduleRender(two)
    // On zoom, ONLY mutate — never call two.update() here. The camera's wheel
    // handler calls two.update() once after dispatching `zoomChanged`, painting
    // every listener's mutation in a single render. A per-listener update would
    // cause N full re-renders per wheel tick (one per line) — the lag the user hit.
    const onZoom = (e: Event): void => {
        const scale = (e as CustomEvent<{ scale: number }>).detail?.scale
        if (!scale) return
        applyHandleCounterScale(handles, scale)
    }
    window.addEventListener('zoomChanged', onZoom as EventListener)
    return (): void => {
        window.removeEventListener('zoomChanged', onZoom as EventListener)
    }
}
