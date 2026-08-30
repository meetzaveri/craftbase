// Three interaction rules that had drifted apart from what the UI promised:
// pan mode is for navigating (not authoring), paste hands the selection to the
// clone, and a geo stroke keeps its counter-scale when its width is edited.

import { test, expect } from './helpers/test.js'
import {
    baseRow,
    GQL_MOCK_RESPONSES,
    setupLocalBase,
    getCanvasBox,
    drawShape,
    clickPointerTool,
} from './helpers/index.js'

const BASE_ID = '11111111-1111-1111-1111-111111111111'
const ANCHOR = { lngLat: [-121.95, 37.35], zoom: 16 }

const ROUTE_ID = 'aaaaaaaa-1111-1111-1111-111111111111'
const TEXT_ID = 'bbbbbbbb-2222-2222-2222-222222222222'
const POINT_ID = 'cccccccc-3333-3333-3333-333333333333'
const MAP_LABEL = 'Map Label'
const PIN_LABEL = 'Pin One'

const geoRecord = (id, componentType, extra) => ({
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
    width: 120,
    height: 120,
    iconStroke: null,
    stroke: '#2f6fb2',
    linewidth: 8,
    strokeType: null,
    textColor: '#3A342C',
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
    geoRecord(ROUTE_ID, 'route', {
        x: 200,
        y: 200,
        metadata: [
            { x: 200, y: 200 },
            { x: 500, y: 260 },
            { x: 700, y: 200 },
        ],
    }),
    geoRecord(TEXT_ID, 'geoText', {
        x: 200,
        y: 420,
        stroke: null,
        linewidth: 2,
        metadata: { content: MAP_LABEL, fontSize: 24, baseTypeScope: 'map' },
    }),
    geoRecord(POINT_ID, 'point', {
        x: 200,
        y: 560,
        fill: '#FF5630',
        stroke: '#FF5630',
        width: 20,
        height: 20,
        metadata: { label: PIN_LABEL },
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
    await page.locator(`text=${MAP_LABEL}`).first().waitFor({ timeout: 15_000 })
    await page.evaluate(() => {
        const two = window.__cbTwo
        two.scene.translation.set(0, 0)
        two.scene.scale = 1
        two.update()
    })
    await page.waitForTimeout(300)
}

/** How many text editors are open, of either kind. */
const openEditors = (page) =>
    page.evaluate(
        () =>
            document.querySelectorAll('textarea.temp-input-area').length +
            document.querySelectorAll('input[id^="point-label-input-"]').length
    )

async function dblclickOn(page, selector) {
    const box = await page.locator(selector).first().boundingBox()
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2)
    await page.waitForTimeout(400)
}

test('pan mode never opens a text editor', async ({ page }) => {
    await openMapBase(page)
    await page.locator('[aria-label="Pan"]').first().click({ force: true })
    expect(await page.evaluate(() => localStorage.getItem('panMode'))).toBe(
        'true'
    )

    // Both editors are reached by a dblclick bound to the element's OWN svg
    // node, which is why the canvas-level guard is not enough on its own.
    await dblclickOn(page, `text=${MAP_LABEL}`)
    expect(
        await openEditors(page),
        'map text opened an editor in pan mode'
    ).toBe(0)
    await dblclickOn(page, `text=${PIN_LABEL}`)
    expect(
        await openEditors(page),
        'a point opened an editor in pan mode'
    ).toBe(0)

    // ...and the guard is pan mode, not a broken editor: select mode still edits.
    await page.locator('[aria-label="Select"]').first().click({ force: true })
    await dblclickOn(page, `text=${MAP_LABEL}`)
    expect(await openEditors(page)).toBe(1)
})

test('a geo stroke keeps its counter-scale when the width is edited', async ({
    page,
}) => {
    await openMapBase(page)

    // Select the route while the camera is at the anchor (easy to hit), then
    // zoom out — the bug only showed below the anchor.
    const clickPoint = await page.evaluate((id) => {
        const g = document.querySelector(`g[data-component-id="${id}"]`)
        const path = Array.from(g.querySelectorAll('path')).find(
            (p) => p.getAttribute('stroke') !== 'transparent'
        )
        const pt = path.getPointAtLength(path.getTotalLength() / 2)
        const svgPt = path.ownerSVGElement.createSVGPoint()
        svgPt.x = pt.x
        svgPt.y = pt.y
        const scr = svgPt.matrixTransform(path.getScreenCTM())
        return { x: scr.x, y: scr.y }
    }, ROUTE_ID)
    await page.mouse.click(clickPoint.x, clickPoint.y)
    await page.waitForSelector('#stroke-width-section')

    const SCALE = 0.0625 // four map zooms below the anchor
    await page.evaluate((scale) => {
        const two = window.__cbTwo
        two.scene.scale = scale
        window.dispatchEvent(
            new CustomEvent('zoomChanged', { detail: { scale } })
        )
        two.update()
    }, SCALE)

    const paintedWidth = () =>
        page.evaluate((id) => {
            const g = document.querySelector(`g[data-component-id="${id}"]`)
            const path = Array.from(g.querySelectorAll('path')).find(
                (p) => p.getAttribute('stroke') !== 'transparent'
            )
            return Number(path.getAttribute('stroke-width'))
        }, ROUTE_ID)

    // route/area paint `linewidth * counterScale(scale, resist)`. Writing the
    // raw value onto the path skipped that factor, so the widest step still
    // rendered hairline-thin until the next zoom or a reload re-applied it.
    await page.locator('#stroke-width-section button[title="2px"]').click()
    const thin = await paintedWidth()
    await page.locator('#stroke-width-section button[title="8px"]').click()
    const thick = await paintedWidth()

    expect(thin, 'the 2px step was painted at world scale').toBeGreaterThan(8)
    expect(thick / thin, 'the two steps are not in proportion').toBeGreaterThan(
        3.5
    )

    // And nothing jumps when the component re-applies its own counter-scale:
    // that jump on the next camera nudge was how the bug announced itself.
    await page.evaluate(() => {
        const two = window.__cbTwo
        window.dispatchEvent(
            new CustomEvent('zoomChanged', {
                detail: { scale: two.scene.scale },
            })
        )
        two.update()
    })
    expect(await paintedWidth()).toBeCloseTo(thick, 3)

    // The record keeps the logical width — only what is painted is scaled.
    expect(
        await page.evaluate(
            (id) =>
                window.__cbTwo.scene.children.find(
                    (c) => c?.elementData?.id === id
                )?.elementData?.linewidth,
            ROUTE_ID
        )
    ).toBe(8)
})

test('paste hands the selection to the clone', async ({ page }) => {
    await setupLocalBase(page)
    const box = await getCanvasBox(page)
    const rect = await drawShape(page, 'rectangle', {
        startX: box.x + 260,
        startY: box.y + 200,
        endX: box.x + 380,
        endY: box.y + 320,
    })
    await clickPointerTool(page)
    const rb = await rect.boundingBox()
    await page.mouse.click(rb.x + rb.width / 2, rb.y + rb.height / 2)
    await page.waitForTimeout(300)

    const sourceId = await page.evaluate(
        () =>
            window.__cbTwo.scene.children.find(
                (c) => c?.elementData?.componentType === 'rectangle'
            )?.elementData?.id
    )

    await page.keyboard.press('Control+c')
    await page.mouse.move(box.x + 600, box.y + 420)
    await page.keyboard.press('Control+v')

    // The selection overlay is scene-level chrome, so whichever rectangle it
    // sits over is the selected one. It used to stay on the SOURCE, which meant
    // the properties panel edited the element you had copied FROM.
    const selected = async () =>
        page.evaluate(() => {
            const chrome = document.querySelector('[data-cb-selection-chrome]')
            if (!chrome) return null
            const c = chrome.getBoundingClientRect()
            const cx = c.x + c.width / 2
            const cy = c.y + c.height / 2
            const rects = Array.from(window.__cbTwo.scene.children).filter(
                (r) => r?.elementData?.componentType === 'rectangle'
            )
            let best = null
            let bestDist = Infinity
            rects.forEach((r) => {
                const b = document.getElementById(r.id).getBoundingClientRect()
                const d =
                    Math.abs(b.x + b.width / 2 - cx) +
                    Math.abs(b.y + b.height / 2 - cy)
                if (d < bestDist) {
                    bestDist = d
                    best = r.elementData.id
                }
            })
            return { id: best, dist: Math.round(bestDist) }
        })

    // The clone mounts through React.lazy, so give the poll room: on a loaded
    // machine the chunk fetch + mount can outlast the default expect timeout.
    await expect
        .poll(async () => (await selected())?.id, { timeout: 15_000 })
        .not.toBe(sourceId)
    const final = await selected()
    expect(
        final.dist,
        'the selection box is not on any rectangle'
    ).toBeLessThan(20)
    expect(
        await page.evaluate(
            () =>
                Array.from(window.__cbTwo.scene.children).filter(
                    (c) => c?.elementData?.componentType === 'rectangle'
                ).length
        )
    ).toBe(2)
})
