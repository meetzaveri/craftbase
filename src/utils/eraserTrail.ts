/**
 * Smudge trail drawn behind the eraser cursor.
 *
 * Only the visual algorithm is craftbase-agnostic: build a short line segment
 * per cursor sample, then decay each one over TRAIL_LIFE frames (fading
 * quadratically while lightening toward the paper). Everything around it — the
 * Two.js instance, the mouse plumbing, the render loop — already exists in
 * newCanvas, so this module borrows those instead of standing up its own.
 *
 * Segment WIDTH is constant over the whole decay and comes from ERASER_DOT_PX
 * — the exact diameter of the dot shown in the toolbar's size selector, so the
 * circle drawn on the canvas is the circle that was picked. Tapering it would
 * break that correspondence for most of the segment's life.
 *
 * Two craftbase-specific twists over a plain fullscreen canvas:
 *
 * 1. Points arrive in SURFACE coords (the ZUI-transformed scene space), so
 *    widths are counter-scaled by the live zoom to keep the beam a constant
 *    on-screen thickness — the same trick the geo objects use.
 * 2. The trail must never be hit-testable. The eraser picks its victims with
 *    `document.elementFromPoint`, so a beam painted over a shape would mask it
 *    and stop the sweep dead.
 */
import Two from 'two.js'
import { scheduleRender } from './renderScheduler'

// Frames a segment lives for (~0.75s at 60fps).
const TRAIL_LIFE = 45
// Minimum on-screen travel before a new segment is emitted, so a jittering
// cursor doesn't pile up degenerate zero-length lines.
const MIN_SEGMENT = 3

// Grey ramp: mid-grey at birth, lightening toward the paper as it fades.
const TRAIL_GREY_DARK = 120
const TRAIL_GREY_LIGHT = 200

interface Segment {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    shape: any
    life: number
    /**
     * On-screen width, snapshotted at emit time so changing the eraser size
     * mid-fade doesn't retroactively resize segments already on screen.
     */
    width: number
}

export interface EraserTrail {
    /** Feed a cursor sample, in surface coords. */
    addPoint: (x: number, y: number) => void
    /** Stroke finished. Live segments keep decaying; the next one starts fresh. */
    end: () => void
    /** Tear down immediately (tool switch / canvas unmount). */
    dispose: () => void
}

export function createEraserTrail(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    two: any,
    /** Full-strength beam width in screen px (tracks the chosen eraser size). */
    getScreenWidth: () => number,
    /** Live ZUI scale, for the counter-scale. */
    getScale: () => number
): EraserTrail {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let group: any = null
    let lastPt: { x: number; y: number } | null = null
    const segs: Segment[] = []
    let frame: number | null = null

    // One group for the canvas's lifetime — never removed. Tearing a parent
    // group down mid-flight is the scene.subtractions crash documented in
    // CLAUDE.md; keeping it resident means only leaf segments are ever
    // subtracted, which is the safe direction.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function ensureGroup(): any {
        if (!group) {
            group = two.makeGroup()
            scheduleRender(two, () => {
                const elem = group?._renderer?.elem
                if (elem) elem.style.pointerEvents = 'none'
            })
        }
        // Elements added since the last sweep sit above the group in the SVG,
        // so re-append its node to paint the beam on top. Reordering a node
        // among its own siblings leaves Two.js's parent bookkeeping intact —
        // unlike sorting scene.children, which would fire an order event.
        const elem = group?._renderer?.elem
        if (elem?.parentNode) elem.parentNode.appendChild(elem)
        return group
    }

    function tick(): void {
        frame = null
        const scale = getScale() || 1

        for (let i = segs.length - 1; i >= 0; i--) {
            const s = segs[i]
            if (!s) continue
            s.life--

            const t = s.life / TRAIL_LIFE
            // Width holds at the eraser diameter for the whole life (see the
            // header note); only the counter-scale is re-applied, because the
            // user can zoom while a segment is still fading.
            s.shape.linewidth = s.width / scale
            s.shape.opacity = t * t
            const grey = Math.round(
                TRAIL_GREY_LIGHT - (TRAIL_GREY_LIGHT - TRAIL_GREY_DARK) * t
            )
            s.shape.stroke = `rgb(${grey}, ${grey}, ${grey})`

            if (s.life <= 0) {
                group?.remove(s.shape)
                segs.splice(i, 1)
            }
        }

        scheduleRender(two)
        if (segs.length > 0) frame = requestAnimationFrame(tick)
    }

    function ensureTicking(): void {
        if (frame === null) frame = requestAnimationFrame(tick)
    }

    return {
        addPoint(x: number, y: number): void {
            const g = ensureGroup()
            if (!lastPt) {
                // Anchor the stroke; the first segment needs a second sample.
                lastPt = { x, y }
                return
            }

            const dx = x - lastPt.x
            const dy = y - lastPt.y
            const scale = getScale() || 1
            // MIN_SEGMENT is a screen-space threshold, so convert before
            // comparing — otherwise the gate tightens as you zoom out.
            if (Math.hypot(dx, dy) * scale < MIN_SEGMENT) return

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const line = new (Two as any).Line(lastPt.x, lastPt.y, x, y)
            const width = getScreenWidth()
            line.noFill()
            line.cap = 'round'
            line.stroke = `rgb(${TRAIL_GREY_DARK}, ${TRAIL_GREY_DARK}, ${TRAIL_GREY_DARK})`
            line.linewidth = width / scale
            g.add(line)

            segs.push({ shape: line, life: TRAIL_LIFE, width })
            lastPt = { x, y }
            ensureTicking()
        },

        end(): void {
            lastPt = null
        },

        dispose(): void {
            if (frame !== null) {
                cancelAnimationFrame(frame)
                frame = null
            }
            for (const s of segs) group?.remove(s.shape)
            segs.length = 0
            lastPt = null
            scheduleRender(two)
        },
    }
}
