// The absolute-vertex-metadata family (area / route / pencil / curvedLine) and
// the three things that kept going wrong with it: a move that did not survive a
// reload, a paste that landed away from the cursor, and a selection that would
// not let go.
//
// All three come from the same place. These types keep their geometry as
// ABSOLUTE coords in `metadata`, and their factories rebuild the path as
// `metadata - (x, y)` — so `x`/`y` is only the origin those vertices were made
// relative to. Anything that moves one of them has to move both, and anything
// that asks "where is it?" has to ask the vertices, not `x`/`y`.

import { test, expect } from './helpers/test.js'
import { baseRow, GQL_MOCK_RESPONSES } from './helpers/index.js'

const BASE_ID = '11111111-1111-1111-1111-111111111111'
const ANCHOR = { lngLat: [-121.95, 37.35], zoom: 16 }
const AREA_ID = 'aaaaaaaa-1111-1111-1111-111111111111'
const ROUTE_ID = 'dddddddd-4444-4444-4444-444444444444'

const geo = (id, componentType, extra) => ({
    id,
    componentType,
    objectClass: 'geo',
    zoomResistant: null,
    children: null,
    x: 0,
    y: 0,
    x1: 0,
    x2: 0,
    y1: 0,
    y2: 0,
    fill: 'transparent',
    width: 250,
    height: 210,
    iconStroke: null,
    stroke: '#2f6fb2',
    linewidth: 6,
    strokeType: null,
    textColor: null,
    opacity: 1,
    position: 1,
    metadata: null,
    tailShapeId: null,
    tailEdge: null,
    headShapeId: null,
    headEdge: null,
    tailPortIndex: null,
    headPortIndex: null,
    ...extra,
})

const COMPONENTS = [
    geo(AREA_ID, 'area', {
        x: 150,
        y: 150,
        metadata: [
            { x: 150, y: 150 },
            { x: 400, y: 150 },
            { x: 400, y: 360 },
            { x: 150, y: 360 },
        ],
    }),
    geo(ROUTE_ID, 'route', {
        x: 150,
        y: 480,
        metadata: [
            { x: 150, y: 480 },
            { x: 400, y: 540 },
            { x: 650, y: 480 },
        ],
    }),
]

async function openMapBase(page) {
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
                          }),
                          components: COMPONENTS,
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
        localStorage.setItem('craftbase_geo_text_zoom_hint_dismissed', '1')
    })
    await page.goto(`/map/${BASE_ID}`)
    await page.waitForSelector(`g[data-component-id="${AREA_ID}"]`, {
        timeout: 15_000,
    })
    // Park the camera at identity so surface coords are screen coords.
    await page.evaluate(() => {
        const two = window.__cbTwo
        two.scene.translation.set(0, 0)
        two.scene.scale = 1
        two.update()
    })
    await page.waitForTimeout(300)
}

/**
 * The record as persisted, plus the number that decides where a reload puts it:
 * `metadata[0] - (x, y)`, the offset the factory rebuilds the path from. A move
 * must leave that offset untouched — if it drifts, the element is drawn
 * somewhere it has never been.
 */
const record = (page, id) =>
    page.evaluate((id) => {
        const g = window.__cbTwo.scene.children.find(
            (c) => c?.elementData?.id === id
        )
        const ed = g?.elementData
        if (!ed || !Array.isArray(ed.metadata)) return null
        return {
            x: ed.x,
            y: ed.y,
            offset: {
                x: ed.metadata[0].x - ed.x,
                y: ed.metadata[0].y - ed.y,
            },
        }
    }, id)

/** A screen point that lies on the element's own stroke. */
const pointOnStroke = (page, id, t = 0.1) =>
    page.evaluate(
        ({ id, t }) => {
            const g = document.querySelector(`g[data-component-id="${id}"]`)
            const path = Array.from(g.querySelectorAll('path')).find(
                (n) =>
                    n.getAttribute('stroke') &&
                    n.getAttribute('stroke') !== 'transparent'
            )
            const pt = path.getPointAtLength(path.getTotalLength() * t)
            const sp = path.ownerSVGElement.createSVGPoint()
            sp.x = pt.x
            sp.y = pt.y
            const scr = sp.matrixTransform(path.getScreenCTM())
            return { x: scr.x, y: scr.y }
        },
        { id, t }
    )

async function dragBy(page, id, dx, dy) {
    const p = await pointOnStroke(page, id)
    await page.mouse.move(p.x, p.y)
    await page.mouse.down()
    await page.mouse.move(p.x + dx, p.y + dy, { steps: 12 })
    await page.mouse.up()
    await page.waitForTimeout(500)
}

for (const [name, id] of [
    ['an area', AREA_ID],
    ['a route', ROUTE_ID],
]) {
    test(`dragging ${name} moves its vertices with its origin`, async ({
        page,
    }) => {
        await openMapBase(page)
        const before = await record(page, id)

        await dragBy(page, id, 120, 90)
        const after = await record(page, id)

        // The origin moved...
        expect(after.x).toBe(before.x + 120)
        expect(after.y).toBe(before.y + 90)
        // ...and the vertices came with it. Persisting the new origin ALONE was
        // worse than persisting nothing: on the next load the factory subtracts
        // the new origin from the old vertices and the shape lands exactly back
        // where the drag started, so the move looked lost on every reload.
        expect(
            after.offset,
            'origin and vertices disagree after a move'
        ).toEqual(before.offset)
    })

    test(`clicking empty canvas deselects ${name} on the first click`, async ({
        page,
    }) => {
        await openMapBase(page)
        const p = await pointOnStroke(page, id, 0.25)
        await page.mouse.click(p.x, p.y)
        await page.waitForSelector('#floating-toolbar')

        const handlesShown = () =>
            page.evaluate((id) => {
                const g = document.querySelector(`g[data-component-id="${id}"]`)
                // Two.js renders a path's opacity as fill/stroke-opacity.
                return Array.from(g.querySelectorAll('path')).filter(
                    (h) =>
                        h.getAttribute('fill') === '#f4f4f2' &&
                        Number(h.getAttribute('fill-opacity') ?? 1) > 0
                ).length
            }, id)
        expect(await handlesShown()).toBeGreaterThan(0)

        // ONE click on bare canvas. The clear used to hang off a DOM heuristic
        // ("the target's last child is the two-0 root") that only matched when
        // the press landed on the wrapper div rather than the SVG or the map
        // canvas — so it took two clicks, or three, or a lucky spot.
        await page.mouse.click(900, 700)
        await page.waitForTimeout(300)

        expect(await handlesShown(), 'vertex handles stayed up').toBe(0)
        expect(
            await page.locator('#floating-toolbar').count(),
            'the properties toolbar stayed open'
        ).toBe(0)
    })
}

test('a pasted area lands under the cursor', async ({ page }) => {
    await openMapBase(page)
    const p = await pointOnStroke(page, AREA_ID, 0.25)
    await page.mouse.click(p.x, p.y)
    await page.waitForSelector('#floating-toolbar')

    await page.keyboard.press('Control+c')
    const cursor = { x: 700, y: 300 }
    await page.mouse.move(cursor.x, cursor.y)
    await page.keyboard.press('Control+v')

    const clone = async () =>
        page.evaluate((srcId) => {
            const g = window.__cbTwo.scene.children.find(
                (c) =>
                    c?.elementData?.componentType === 'area' &&
                    c.elementData.id !== srcId
            )
            if (!g) return null
            const box = document.getElementById(g.id).getBoundingClientRect()
            const ed = g.elementData
            return {
                centre: {
                    x: Math.round(box.x + box.width / 2),
                    y: Math.round(box.y + box.height / 2),
                },
                offset: {
                    x: ed.metadata[0].x - ed.x,
                    y: ed.metadata[0].y - ed.y,
                },
            }
        }, AREA_ID)

    // Same reason as the paste test in canvas-interaction-fixes: the clone
    // mounts lazily, and a loaded machine takes longer than the default poll.
    await expect
        .poll(async () => !!(await clone()), { timeout: 15_000 })
        .toBe(true)
    const pasted = await clone()

    // Under the cursor, not a corner's-worth away from it: the offset used to be
    // measured from `x`/`y`, which for these types is wherever the first vertex
    // happened to fall.
    expect(Math.abs(pasted.centre.x - cursor.x)).toBeLessThan(12)
    expect(Math.abs(pasted.centre.y - cursor.y)).toBeLessThan(12)

    // And the clone is born consistent — origin and vertices in step, so its
    // own first drag/reload behaves.
    const source = await record(page, AREA_ID)
    expect(pasted.offset).toEqual(source.offset)
})
