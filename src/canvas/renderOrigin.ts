// Floating render origin — the fix for far-from-anchor elements shaking on zoom.
//
// THE PROBLEM
//
// A map base pins surface (0,0) to its anchor and stores every element as an
// absolute Mercator-pixel offset from it (see baseTypes/mercator.ts). The world
// at anchor zoom 16 is 512 · 2^16 = 33,554,432 px across, so distance from the
// anchor becomes coordinate magnitude: Leeds sits 7,868,457 surface units from
// an Ahmedabad anchor, Denver 16,651,516.
//
// Those coordinates reach the browser as SVG transforms, and SVG matrices are
// composed in float32 — a 24-bit mantissa. On screen an element lands at
// `T + s·P`, where the camera's `T ≈ −s·P` for anything actually visible: two
// huge numbers that nearly cancel. Textbook catastrophic cancellation, where
// the error scales with the *operands*, not the result. Measured in Chromium,
// sweeping the scale the way a pinch does:
//
//   distance from anchor   wander at s=1   wander at s=4
//   0 (the anchor)              0px             0px
//   84,000 (~100km)             0.036px         0.098px
//   7,868,457 (Leeds)           3.24px          7.88px
//   16,651,516 (Denver)         7.40px          15.92px
//
// That wander changes as the scale changes, which is exactly what a user sees
// as shaking while zooming — and why it settles the moment they stop. Content
// near the anchor never shakes because its coordinates are near zero.
//
// THE FIX
//
// Insert one node carrying `translate(−O)` between the camera and the elements,
// with O a render origin near the camera. The browser then computes `P − O`
// between two nearby values — exact, by Sterbenz — and multiplies the small
// result by the scale. Measured on the same sweep, this takes Leeds from 3.24px
// to 0.0015px and Denver from 7.40px to 0.0023px.
//
// WHY IT IS DOM-ONLY
//
// The obvious shape — a Two.js Group holding every element — would put the
// rebase node *into* `two.scene.children`, where 63 call sites enumerate
// components and 46 more add/remove them. It would be a component in every list
// that matters, and element coordinates would have to become render-space,
// touching 308 `.translation`/`.position` sites.
//
// So this never touches the Two.js scene graph. It moves the scene's *rendered*
// `<g>` inside a wrapper `<g>` we own and rewrites two transform attributes
// after each render, splitting the camera across the pair:
//
//   wrapper <g>  matrix(s, T + s·O)     <- the camera
//     scene <g>  matrix(1, −O)          <- the rebase (Two.js's own node)
//       elem <g> matrix(1, P)           <- untouched, still absolute
//
// which composes to `T + s·P`, identical to today. `two.scene.children` still
// holds exactly the elements; `two.scene.scale`/`translation` still mean the
// camera; every element's `translation` is still absolute surface coords; the
// ZUI, hit-testing and `clientToSurface` are untouched. Two O(1) attribute
// writes per frame, no per-element work.
//
// Safe because Two.js appends the scene's `<g>` to the <svg> exactly once — the
// SVG renderer only appends when `_renderer.elem` is absent (two.js
// renderers/svg.js, group.render) — so it never re-parents the node back out.
// And it writes the scene transform only when the matrix is flagged, so our
// override survives frames where the camera did not move.

const SVG_NS = 'http://www.w3.org/2000/svg'

/** Marks the wrapper so nothing mistakes it for canvas content (exports, tests). */
export const RENDER_ORIGIN_ID = 'cb-render-origin'

/**
 * How far, in screen px, the origin is allowed to sit from the viewport centre.
 * The grid is chosen per-frame as a power of two near `ORIGIN_SLACK_PX / scale`,
 * which keeps `s·(centre − O)` under this bound at every zoom — so the numbers
 * the browser actually composes stay viewport-sized.
 *
 * A power of two matters: O must itself be exactly representable in float32 or
 * it reintroduces the error it exists to remove. Any `m · 2^k` with m under
 * 2^24 is exact, and snapping to a power-of-two grid guarantees that form.
 */
const ORIGIN_SLACK_PX = 1024

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwoLike = any

/** Two.js `scale` is a number when uniform, a Two.Vector when not. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function uniformScale(scale: any): number {
    if (typeof scale === 'number') return scale
    return scale?.x ?? 1
}

/** The power-of-two grid the origin snaps to at this scale. */
function gridFor(scale: number): number {
    const raw = ORIGIN_SLACK_PX / scale
    // Clamp the exponent so a pathological scale can't produce a grid of 0 or
    // one so coarse that O stops tracking the camera at all.
    const k = Math.max(-8, Math.min(24, Math.ceil(Math.log2(raw))))
    return Math.pow(2, k)
}

export interface RenderOriginHandle {
    /** Current origin, in surface coords. Exposed for diagnostics and tests. */
    current(): { x: number; y: number }
    uninstall(): void
}

/**
 * Install the floating render origin on a Two.js instance. Idempotent per
 * instance in practice (Canvas mounts once); returns a handle whose
 * `uninstall()` unbinds the hook and unwraps the DOM.
 */
export function installRenderOrigin(two: TwoLike): RenderOriginHandle {
    let wrapper: SVGGElement | null = null
    let originX = 0
    let originY = 0

    const apply = (): void => {
        const scene = two?.scene
        const sceneEl: SVGGElement | undefined = scene?._renderer?.elem
        if (!sceneEl) return

        const parent = sceneEl.parentNode as Element | null
        if (!parent) return

        // Wrap on the first render that has a rendered scene node, and re-wrap
        // if anything ever re-parents it (defensive; Two.js does not).
        if (!wrapper || sceneEl.parentNode !== wrapper) {
            if (!wrapper) {
                wrapper = document.createElementNS(SVG_NS, 'g')
                wrapper.setAttribute('id', RENDER_ORIGIN_ID)
            }
            parent.insertBefore(wrapper, sceneEl)
            wrapper.appendChild(sceneEl)
        }

        const s = uniformScale(scene.scale)
        const t = scene.translation
        if (!Number.isFinite(s) || s <= 0 || !t) return

        const width = two.width || window.innerWidth
        const height = two.height || window.innerHeight

        // Surface point under the viewport centre: screen = T + s·surface.
        const centreX = (width / 2 - t.x) / s
        const centreY = (height / 2 - t.y) / s

        const grid = gridFor(s)
        originX = Math.round(centreX / grid) * grid
        originY = Math.round(centreY / grid) * grid

        // Split the camera: the wrapper carries scale and a translation that
        // re-absorbs the origin, so the composition is unchanged. Both terms are
        // computed here in float64 and land small, which is the whole point.
        wrapper.setAttribute(
            'transform',
            `matrix(${s} 0 0 ${s} ${t.x + s * originX} ${t.y + s * originY})`
        )
        // Overwrite whatever Two.js just wrote for the scene: it is the rebase
        // node now, not the camera. Two.js's own matrices are untouched, so
        // every JS-side reader still sees the real camera on two.scene.
        sceneEl.setAttribute(
            'transform',
            `matrix(1 0 0 1 ${-originX} ${-originY})`
        )
    }

    two.bind('render', apply)
    // Run once now in case a render already happened before install.
    apply()

    return {
        current: () => ({ x: originX, y: originY }),
        uninstall: (): void => {
            two.unbind('render', apply)
            const sceneEl = two?.scene?._renderer?.elem as
                | SVGGElement
                | undefined
            if (wrapper && sceneEl && sceneEl.parentNode === wrapper) {
                wrapper.parentNode?.insertBefore(sceneEl, wrapper)
                sceneEl.setAttribute('transform', 'matrix(1 0 0 1 0 0)')
                wrapper.remove()
            }
            wrapper = null
        },
    }
}
