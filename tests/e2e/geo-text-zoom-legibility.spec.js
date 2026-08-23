// Map text must stay readable at every zoom.
//
// geoText renders in Two.js surface space, so without zoom-resistance its
// on-screen size is `fontSize * zuiScale` — and on a map base zuiScale is
// `2^(mapZoom - anchor.zoom)` across 18 stops. Against the z16 default anchor
// that put an 18px label at 0.2px over a county: present in the DOM, invisible
// on screen, and impossible to type into (the editing overlay sizes itself to
// match the glyphs it covers). The counter-scale (GEO_TEXT_RESIST) is what
// keeps the label inside a legible band instead.
//
// Guards the band, not an exact size: the resist constant is a tuning knob and
// glyph metrics vary by font, so pinning exact pixels here would fail on any
// future tweak that is still perfectly readable.

import { test, expect } from './helpers/test.js'
import { baseRow, GQL_MOCK_RESPONSES } from './helpers/index.js'

const BASE_ID = '11111111-1111-1111-1111-111111111111'
// Santa Clara County, at the default anchor zoom.
const ANCHOR = { lngLat: [-121.95, 37.35], zoom: 16 }
const LABEL = 'Santa Clara'
// The mobile "M" size (MOBILE_TEXT_SIZES_OBJECT) — the case that was reported.
const FONT_SIZE = 18

// The whole reachable range: MAX_MAP_ZOOM (19) down to MIN_MAP_ZOOM (1),
// per baseTypes/zoomLimits.ts.
const MAP_ZOOMS = [19, 16, 13, 10, 5, 1]

const MIN_LEGIBLE_PX = 6
const MAX_REASONABLE_PX = 60

const geoTextRecord = (id) => ({
    id,
    componentType: 'geoText',
    objectClass: 'geo',
    children: null,
    metadata: { content: LABEL, fontSize: FONT_SIZE, baseTypeScope: 'map' },
    x: 0, x1: 0, x2: 0, y: 0, y1: 0, y2: 0,
    fill: 'transparent', width: 120, height: 36,
    iconStroke: null, stroke: null, linewidth: 2, strokeType: null,
    textColor: '#3A342C', opacity: 1, position: 1,
    tailShapeId: null, tailEdge: null, headShapeId: null, headEdge: null,
    tailPortIndex: null, headPortIndex: null,
})

test('map text stays legible across the whole map zoom range', async ({
    page,
}) => {
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
                          components: [
                              geoTextRecord(
                                  'aaaaaaaa-1111-1111-1111-111111111111'
                              ),
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
    await page.locator(`text=${LABEL}`).first().waitFor({ timeout: 15_000 })

    /**
     * Drive the camera to a scale and report the label's on-screen height.
     * Setting scene.scale + dispatching `zoomChanged` is exactly what the
     * canvas's own zoom handlers do (five dispatch sites in newCanvas.tsx).
     */
    const apparentHeightAt = async (scale) =>
        page.evaluate(
            ({ s, label }) => {
                const two = window.__cbTwo
                two.scene.scale = s
                window.dispatchEvent(
                    new CustomEvent('zoomChanged', { detail: { scale: s } })
                )
                two.update()
                const el = Array.from(
                    document.querySelectorAll('text')
                ).find((n) => n.textContent === label)
                return el ? el.getBoundingClientRect().height : null
            },
            { s: scale, label: LABEL }
        )

    for (const mapZoom of MAP_ZOOMS) {
        const scale = Math.pow(2, mapZoom - ANCHOR.zoom)
        const px = await apparentHeightAt(scale)

        expect(px, `label missing at map zoom ${mapZoom}`).not.toBeNull()
        expect(
            px,
            `at map zoom ${mapZoom} (zuiScale ${scale}) the label rendered at ${px}px`
        ).toBeGreaterThan(MIN_LEGIBLE_PX)
        expect(
            px,
            `at map zoom ${mapZoom} (zuiScale ${scale}) the label rendered at ${px}px`
        ).toBeLessThan(MAX_REASONABLE_PX)
    }
})
