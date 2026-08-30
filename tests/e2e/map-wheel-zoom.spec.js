// The camera input model is a property of the base type.
//
// A map base speaks the map idiom: the wheel zooms, a drag over empty canvas
// moves the geography, and shift+drag is what is left for box select. A board
// base keeps the whiteboard idiom: the wheel pans, a modifier zooms, a drag
// marquees. Both models run through the SAME handlers in newCanvas.tsx,
// branching on `activeBaseTypeRef` — which is exactly why they need a test
// each. Getting one right by breaking the other is the failure mode here.
//
// Note this is the first spec in the suite to drive a real `wheel` event and a
// real mouse drag against the camera; every other zoom test reaches in through
// `window.__cbZui` and a synthetic `zoomChanged`, which would have passed no
// matter what the wheel handler did.

import { test, expect } from './helpers/test.js'
import {
    baseRow,
    GQL_MOCK_RESPONSES,
    setupLocalBase,
    getCanvasBox,
    readCamera,
} from './helpers/index.js'

const BASE_ID = '11111111-1111-1111-1111-111111111111'

// Elland Road, Leeds. An anchor has to be present or the first-run "where are
// you mapping?" prompt opens, and answering it calls enterPanMode() — which
// would put every drag test in the pan tool and prove nothing about select
// mode, the thing under test.
const ANCHOR = { lngLat: [-1.5722, 53.7778], zoom: 16 }
const LANDING = { lngLat: [-1.5722, 53.7778], zoom: 16 }

const POINT_ID = '22222222-2222-2222-2222-222222222222'

/** A pin on the map, at surface (0,0) — i.e. dead on the anchor. */
const point = () => ({
    id: POINT_ID,
    componentType: 'point',
    objectClass: 'geo',
    children: null,
    metadata: { content: 'The Old Peacock' },
    x: 0, x1: 0, x2: 0, y: 0, y1: 0, y2: 0,
    fill: '#e5484d', width: 10, height: 10,
    iconStroke: null, stroke: '#e5484d', linewidth: 2, strokeType: null,
    textColor: '#3A342C', opacity: 1, position: 1,
    tailShapeId: null, tailEdge: null, headShapeId: null, headEdge: null,
    tailPortIndex: null, headPortIndex: null,
})

async function openMapBase(page, { components = [] } = {}) {
    await page.route('**/v1/graphql', async (route) => {
        let data = {}
        try {
            const body = JSON.parse(route.request().postData() || '{}')
            data =
                body.operationName === 'getComponentsForBase'
                    ? {
                          base: baseRow({
                              id: BASE_ID,
                              type: 'map',
                              anchor: ANCHOR,
                              landing: LANDING,
                          }),
                          components,
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
    await page.waitForSelector('#main-two-root svg', { timeout: 15_000 })
    // The landing camera is applied a beat after mount; read a stable camera.
    await page.waitForTimeout(1200)
}

test.describe('map base: the wheel zooms', () => {
    test('a plain wheel changes scale, not translation alone', async ({
        page,
    }) => {
        await openMapBase(page)
        const box = await getCanvasBox(page)

        const before = await page.evaluate(readCamera)
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.wheel(0, -300)
        await page.waitForTimeout(300)
        const after = await page.evaluate(readCamera)

        expect(after.scale).toBeGreaterThan(before.scale)

        // Scrolling the other way must come back down, so the sign is right
        // and this isn't a one-directional accident.
        await page.mouse.wheel(0, 600)
        await page.waitForTimeout(300)
        const out = await page.evaluate(readCamera)
        expect(out.scale).toBeLessThan(after.scale)
    })

    test('the zoom is anchored on the cursor, not the viewport centre', async ({
        page,
    }) => {
        await openMapBase(page)
        const box = await getCanvasBox(page)

        // Surface point under a deliberately off-centre cursor. If the zoom is
        // cursor-anchored it stays put in client space across the zoom.
        const cx = box.x + box.width * 0.75
        const cy = box.y + box.height * 0.3
        const surfaceUnderCursor = () =>
            page.evaluate(
                ([x, y]) => {
                    const two = window.__cbTwo
                    return {
                        x: (x - two.scene.translation.x) / two.scene.scale,
                        y: (y - two.scene.translation.y) / two.scene.scale,
                    }
                },
                [cx, cy]
            )

        await page.mouse.move(cx, cy)
        const before = await surfaceUnderCursor()
        await page.mouse.wheel(0, -300)
        await page.waitForTimeout(300)
        const after = await surfaceUnderCursor()

        expect(Math.abs(after.x - before.x)).toBeLessThan(1)
        expect(Math.abs(after.y - before.y)).toBeLessThan(1)
    })
})

test.describe('board base: the wheel still pans', () => {
    test('a plain wheel translates and leaves scale alone', async ({ page }) => {
        await setupLocalBase(page)
        const box = await getCanvasBox(page)

        const before = await page.evaluate(readCamera)
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.wheel(0, -300)
        await page.waitForTimeout(300)
        const after = await page.evaluate(readCamera)

        expect(after.scale).toBeCloseTo(before.scale, 6)
        expect(after.ty).not.toBeCloseTo(before.ty, 1)
    })

    test('a modifier wheel still zooms', async ({ page }) => {
        await setupLocalBase(page)
        const box = await getCanvasBox(page)

        const before = await page.evaluate(readCamera)
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.keyboard.down('Shift')
        await page.mouse.wheel(0, -300)
        await page.keyboard.up('Shift')
        await page.waitForTimeout(300)
        const after = await page.evaluate(readCamera)

        expect(after.scale).toBeGreaterThan(before.scale)
    })
})

test.describe('map base: a drag over empty canvas pans', () => {
    test('plain drag translates the camera and creates no group', async ({
        page,
    }) => {
        await openMapBase(page)
        const box = await getCanvasBox(page)

        const before = await page.evaluate(readCamera)
        const startX = box.x + box.width * 0.6
        const startY = box.y + box.height * 0.6

        await page.mouse.move(startX, startY)
        await page.mouse.down()
        await page.mouse.move(startX - 120, startY - 80, { steps: 12 })
        await page.mouse.up()
        await page.waitForTimeout(300)

        const after = await page.evaluate(readCamera)
        expect(after.scale).toBeCloseTo(before.scale, 6)
        expect(after.tx - before.tx).toBeLessThan(-80)
        expect(after.ty - before.ty).toBeLessThan(-50)

        // The marquee's product is a groupobject; if the pan branch let the
        // selector through, one would be sitting on the canvas.
        const groups = await page.$$('[data-label="groupobject_coord"]')
        expect(groups).toHaveLength(0)
    })

    test('shift+drag still marquees instead of panning', async ({ page }) => {
        await openMapBase(page)
        const box = await getCanvasBox(page)

        const before = await page.evaluate(readCamera)
        const startX = box.x + box.width * 0.6
        const startY = box.y + box.height * 0.6

        await page.keyboard.down('Shift')
        await page.mouse.move(startX, startY)
        await page.mouse.down()
        await page.mouse.move(startX - 120, startY - 80, { steps: 12 })
        await page.mouse.up()
        await page.keyboard.up('Shift')
        await page.waitForTimeout(300)

        const after = await page.evaluate(readCamera)
        expect(after.tx).toBeCloseTo(before.tx, 1)
        expect(after.ty).toBeCloseTo(before.ty, 1)
    })

    test('a drag that starts on a point moves the point, not the camera', async ({
        page,
    }) => {
        await openMapBase(page, { components: [point()] })

        // null means "no pin on the canvas", which is a real assertion below.
        // A missing handle is a different failure and must not masquerade as it.
        const pointPos = () =>
            page.evaluate(() => {
                const two = window.__cbTwo
                if (!two) throw new Error('__cbTwo is missing')
                const g = Array.from(two.scene.children).find(
                    (c) => c?.elementData?.componentType === 'point'
                )
                return g ? { x: g.translation.x, y: g.translation.y } : null
            })

        const startPos = await pointPos()
        expect(startPos).not.toBeNull()

        const camBefore = await page.evaluate(readCamera)

        // Aim at the pin's own SVG node rather than at where the camera says
        // surface (0,0) landed: the pin is a 10px circle, so a few pixels of
        // drift between the record and the rendered group is the difference
        // between grabbing it and grabbing the map behind it.
        const pin = await page
            .locator(`[data-component-id="${POINT_ID}"]`)
            .boundingBox()
        expect(pin).not.toBeNull()
        const clientX = pin.x + pin.width / 2
        const clientY = pin.y + pin.height / 2

        await page.mouse.move(clientX, clientY)
        await page.mouse.down()
        await page.mouse.move(clientX + 90, clientY + 60, { steps: 12 })
        await page.mouse.up()
        await page.waitForTimeout(400)

        const camAfter = await page.evaluate(readCamera)
        const endPos = await pointPos()

        // The camera stayed put and the pin moved — the hit test claimed the
        // gesture before the pan branch could.
        expect(camAfter.tx).toBeCloseTo(camBefore.tx, 0)
        expect(camAfter.ty).toBeCloseTo(camBefore.ty, 0)
        expect(Math.abs(endPos.x - startPos.x)).toBeGreaterThan(20)
    })
})
