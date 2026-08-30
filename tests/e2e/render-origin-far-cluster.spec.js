// Elements far from a map base's anchor must not shake while zooming.
//
// Surface coords are absolute Mercator-pixel offsets from the anchor, so
// distance becomes magnitude: Leeds is ~7.9M surface units from an Ahmedabad
// anchor. Those reach the browser as SVG transforms, which compose in float32,
// and a visible element sits at `T + s·P` where `T ≈ −s·P` — catastrophic
// cancellation whose error scales with the operands. As the scale changes
// through a zoom the error changes with it, which is what a user sees as
// shaking. Content near the anchor never shakes, because its coords are ~0.
//
// canvas/renderOrigin.ts fixes it by splitting the camera across a wrapper <g>
// so the browser only ever composes viewport-sized numbers.
//
// This asserts on RENDERING error specifically — rendered position minus the
// float64 position the camera intends — so it cannot be fooled by the camera
// itself being imprecise, or by an element's counter-scale resizing its box.

import { test, expect } from './helpers/test.js'
import { baseRow, GQL_MOCK_RESPONSES } from './helpers/index.js'

const BASE_ID = '11111111-1111-1111-1111-111111111111'
// Anchored on Ahmedabad, with a pin placed across the continent in Leeds.
const ANCHOR = { lngLat: [72.5714, 23.0225], zoom: 16 }
const FAR = { x: -6910684, y: -3762320 } // Leeds, in surface units
const NEAR = { x: 120, y: 80 } // beside the anchor — the control

const FAR_ID = 'aaaaaaaa-1111-1111-1111-111111111111'
const NEAR_ID = 'bbbbbbbb-1111-1111-1111-111111111111'

// Comfortably under a pixel. Measured, the fix lands at ~0.0002px and the old
// behaviour at 6.5-7.5px, so there is no ambiguity about which side this is on.
const MAX_RENDER_WANDER_PX = 0.5

const pin = (id, x, y, label) => ({
    id,
    componentType: 'point',
    objectClass: 'geo',
    children: null,
    metadata: { content: label, label },
    x, x1: 0, x2: 0, y, y1: 0, y2: 0,
    fill: '#e5484d', width: 10, height: 10,
    iconStroke: null, stroke: '#e5484d', linewidth: 2, strokeType: null,
    textColor: '#3A342C', opacity: 1, position: 1,
    tailShapeId: null, tailEdge: null, headShapeId: null, headEdge: null,
    tailPortIndex: null, headPortIndex: null,
})

async function openBase(page) {
    await page.route('**/v1/graphql', async (route) => {
        let data = {}
        try {
            const body = JSON.parse(route.request().postData() || '{}')
            data =
                body.operationName === 'getComponentsForBase'
                    ? {
                          base: baseRow({ id: BASE_ID, type: 'map', anchor: ANCHOR }),
                          components: [
                              pin(FAR_ID, FAR.x, FAR.y, 'Leeds'),
                              pin(NEAR_ID, NEAR.x, NEAR.y, 'Ahmedabad'),
                          ],
                      }
                    : (GQL_MOCK_RESPONSES[body.operationName] ?? {})
        } catch (_) {}
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data }),
        })
    })
    await page.addInitScript(() => {
        localStorage.setItem('userId', 'test-user-id')
        localStorage.setItem('craftbase_welcome_dismissed', '1')
    })
    await page.goto(`/map/${BASE_ID}`)
    await page.locator(`[data-component-id="${FAR_ID}"]`).first().waitFor({ timeout: 15_000 })
}

/**
 * Peak-to-peak rendering error for one pin across a zoom sweep, in screen px.
 * Keeps the pin centred and compares where the browser draws its group origin
 * against where the camera's own float64 arithmetic says it should be.
 */
const renderWander = (page, target, id, baseScale) =>
    page.evaluate(
        ({ target, id, baseScale }) => {
            const two = window.__cbTwo
            const zui = window.__cbZui
            let lo = Infinity
            let hi = -Infinity
            for (let i = 0; i <= 120; i++) {
                zui.zoomSet(baseScale * Math.pow(2, i / 120), 0, 0)
                const [cx, cy] = zui.surfaceMatrix.multiply(target.x, target.y, 1)
                zui.translateSurface(two.width / 2 - cx, two.height / 2 - cy)
                window.dispatchEvent(
                    new CustomEvent('zoomChanged', {
                        detail: { scale: two.scene.scale },
                    })
                )
                two.update()

                const g = document.querySelector(`g[data-component-id="${id}"]`)
                if (!g) continue
                // Read the scale the camera ACTUALLY adopted — zoomSet clamps to
                // the base type's zoom limits, so the requested value can differ.
                const s = two.scene.scale
                const intended = two.scene.translation.x + s * target.x
                // The group's local origin, immune to the counter-scale resizing
                // its bounding box.
                const drawn = new DOMPoint(0, 0).matrixTransform(g.getScreenCTM()).x
                const dev = drawn - intended
                if (dev < lo) lo = dev
                if (dev > hi) hi = dev
            }
            return hi - lo
        },
        { target, id, baseScale }
    )

test.describe('render origin keeps far-from-anchor content steady', () => {
    test('a cluster a continent away does not drift while zooming', async ({ page }) => {
        await openBase(page)

        for (const [label, scale] of [
            ['zoomed out', 1 / 64],
            ['at anchor zoom', 1],
            ['zoomed in', 4],
        ]) {
            const wander = await renderWander(page, FAR, FAR_ID, scale)
            expect(
                wander,
                `far cluster drifted ${wander.toFixed(3)}px ${label}`
            ).toBeLessThan(MAX_RENDER_WANDER_PX)
        }

        // The control: content at the anchor was never affected, and must stay
        // that way — a "fix" that traded one for the other would pass above.
        const near = await renderWander(page, NEAR, NEAR_ID, 1)
        expect(near, 'content at the anchor drifted').toBeLessThan(MAX_RENDER_WANDER_PX)
    })

    test('the wrapper is DOM-only: it is not a component', async ({ page }) => {
        await openBase(page)

        const structure = await page.evaluate(() => {
            const two = window.__cbTwo
            const wrapper = document.getElementById('cb-render-origin')
            const sceneEl = two.scene._renderer.elem
            return {
                wrapperExists: !!wrapper,
                sceneIsInsideWrapper: sceneEl.parentNode === wrapper,
                // The scene graph must not know the wrapper exists: every
                // component enumeration in the app reads scene.children.
                inSceneChildren: Array.from(two.scene.children).some(
                    (c) => c?.id === 'cb-render-origin'
                ),
                everyChildIsRenderable: Array.from(two.scene.children).every(
                    (c) => !!c && typeof c.id === 'string'
                ),
            }
        })

        expect(structure.wrapperExists).toBe(true)
        expect(structure.sceneIsInsideWrapper).toBe(true)
        expect(structure.inSceneChildren, 'the wrapper leaked into the component list').toBe(false)
        expect(structure.everyChildIsRenderable).toBe(true)
    })

    test('element coordinates stay absolute surface coords', async ({ page }) => {
        await openBase(page)

        // The whole point of doing this in the DOM: nothing in JS had to move to
        // render-space, so a far element's translation still reads as the exact
        // value stored on its row.
        const coords = await page.evaluate((id) => {
            const two = window.__cbTwo
            const el = Array.from(two.scene.children).find(
                (c) => c?.elementData?.id === id
            )
            return el ? { x: el.translation.x, y: el.translation.y } : null
        }, FAR_ID)

        expect(coords).not.toBeNull()
        expect(coords.x).toBe(FAR.x)
        expect(coords.y).toBe(FAR.y)
    })
})
