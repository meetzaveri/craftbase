// The "Zoom resistant" switch on map text — and, more importantly, that it is
// PER RECORD.
//
// geoText renders in Two.js surface space, so its on-screen size is
// `fontSize * zuiScale` unless something counter-scales it. By default
// something does (GEO_TEXT_RESIST), which is what geo-text-zoom-legibility
// guards. This spec covers the opt-out: the `zoomResistant` column, `false`
// meaning "resist 0, scale with the geography".
//
// The load-bearing assertion is the second test. Zoom-resistance is applied by
// a `zoomChanged` event broadcast to EVERY element, and the toggle reaches a
// live element through another broadcast event (props are frozen at mount by
// ElementRenderWrapper). Both are shouted at the whole canvas and filtered by
// id on the far side — so "A opted out, B did not, in the same frame" is
// exactly the property a regression here would break.

import { test, expect } from './helpers/test.js'
import { baseRow, GQL_MOCK_RESPONSES } from './helpers/index.js'

const BASE_ID = '11111111-1111-1111-1111-111111111111'
// Santa Clara County, at the default anchor zoom.
const ANCHOR = { lngLat: [-121.95, 37.35], zoom: 16 }
const FONT_SIZE = 18

const RESISTANT_ID = 'aaaaaaaa-1111-1111-1111-111111111111'
const SCALING_ID = 'bbbbbbbb-2222-2222-2222-222222222222'
const RESISTANT_LABEL = 'Stays Legible'
const SCALING_LABEL = 'Grows With Map'

// Mirrors the band in geo-text-zoom-legibility.spec.js.
const MIN_LEGIBLE_PX = 6
const MAX_REASONABLE_PX = 60

const geoTextRecord = (id, content, zoomResistant) => ({
    id,
    componentType: 'geoText',
    objectClass: 'geo',
    zoomResistant,
    children: null,
    metadata: { content, fontSize: FONT_SIZE, baseTypeScope: 'map' },
    // Offset so the two labels never overlap and each keeps its own box.
    x: 0, x1: 0, x2: 0, y: id === SCALING_ID ? 120 : 0, y1: 0, y2: 0,
    fill: 'transparent', width: 120, height: 36,
    iconStroke: null, stroke: null, linewidth: 2, strokeType: null,
    textColor: '#3A342C', opacity: 1, position: 1,
    tailShapeId: null, tailEdge: null, headShapeId: null, headEdge: null,
    tailPortIndex: null, headPortIndex: null,
})

async function openMapBase(page, components) {
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
        // Keep the one-shot zoom tip out of the way; it is not under test here
        // and it renders in the same corner of the viewport.
        localStorage.setItem('craftbase_geo_text_zoom_hint_dismissed', '1')
    })
    await page.goto(`/map/${BASE_ID}`)
}

/**
 * Drive the camera to a scale and report each label's on-screen height.
 * Setting scene.scale + dispatching `zoomChanged` is exactly what the canvas's
 * own zoom handlers do (five dispatch sites in newCanvas.tsx).
 */
const heightsAt = (page, scale, labels) =>
    page.evaluate(
        ({ s, labels }) => {
            const two = window.__cbTwo
            two.scene.scale = s
            window.dispatchEvent(
                new CustomEvent('zoomChanged', { detail: { scale: s } })
            )
            two.update()
            const nodes = Array.from(document.querySelectorAll('text'))
            const out = {}
            labels.forEach((label) => {
                const el = nodes.find((n) => n.textContent === label)
                out[label] = el ? el.getBoundingClientRect().height : null
            })
            return out
        },
        { s: scale, labels }
    )

test('opting out of zoom-resistance makes map text scale with the map', async ({
    page,
}) => {
    await openMapBase(page, [
        geoTextRecord(SCALING_ID, SCALING_LABEL, false),
    ])
    await page.locator(`text=${SCALING_LABEL}`).first().waitFor({
        timeout: 15_000,
    })

    // At the anchor zoom (scale 1) the two models agree — resist only shows up
    // once the camera moves away from 1.
    const atAnchor = await heightsAt(page, 1, [SCALING_LABEL])
    const anchorPx = atAnchor[SCALING_LABEL]
    expect(anchorPx, 'label missing at the anchor zoom').not.toBeNull()

    // Six map zooms out: surface-space text should shrink by ~2^-6, taking it
    // well under the legibility floor the resistant default holds above. Assert
    // the ratio rather than a pixel value — glyph metrics vary by font.
    const zoomedOut = await heightsAt(page, Math.pow(2, -6), [SCALING_LABEL])
    const outPx = zoomedOut[SCALING_LABEL]

    expect(outPx).not.toBeNull()
    expect(
        outPx,
        `opted-out label rendered at ${outPx}px zoomed out, vs ${anchorPx}px at the anchor — it is not tracking the camera`
    ).toBeLessThan(anchorPx / 8)
    expect(
        outPx,
        'an opted-out label should fall below the legibility floor when zoomed out — that is the whole point of the default'
    ).toBeLessThan(MIN_LEGIBLE_PX)
})

test('zoom-resistance is per record: one label opts out, the other does not', async ({
    page,
}) => {
    await openMapBase(page, [
        // `null` is the shipped state for every row written before the column
        // existed, and reads as zoom-resistant.
        geoTextRecord(RESISTANT_ID, RESISTANT_LABEL, null),
        geoTextRecord(SCALING_ID, SCALING_LABEL, false),
    ])
    await page.locator(`text=${RESISTANT_LABEL}`).first().waitFor({
        timeout: 15_000,
    })
    await page.locator(`text=${SCALING_LABEL}`).first().waitFor({
        timeout: 15_000,
    })

    const labels = [RESISTANT_LABEL, SCALING_LABEL]
    const baseline = await heightsAt(page, 1, labels)

    // Sweep the reachable range (MAX_MAP_ZOOM 19 down to MIN_MAP_ZOOM 1 against
    // a z16 anchor, per baseTypes/zoomLimits.ts). Both labels ride the same
    // `zoomChanged` broadcast, in the same frame, and must diverge.
    for (const mapZoom of [19, 16, 13, 10, 5, 1]) {
        const scale = Math.pow(2, mapZoom - ANCHOR.zoom)
        const px = await heightsAt(page, scale, labels)

        expect(
            px[RESISTANT_LABEL],
            `resistant label missing at map zoom ${mapZoom}`
        ).not.toBeNull()
        expect(
            px[RESISTANT_LABEL],
            `at map zoom ${mapZoom} the resistant label rendered at ${px[RESISTANT_LABEL]}px`
        ).toBeGreaterThan(MIN_LEGIBLE_PX)
        expect(
            px[RESISTANT_LABEL],
            `at map zoom ${mapZoom} the resistant label rendered at ${px[RESISTANT_LABEL]}px`
        ).toBeLessThan(MAX_REASONABLE_PX)

        // The opted-out label tracks the camera: height ∝ zuiScale. Only
        // assert the ratio where the result is actually measurable — by map
        // zoom 5 the true height is ~0.01px and getBoundingClientRect reports
        // a rounded 0, so a proportionality check there would be testing the
        // browser's pixel rounding, not our counter-scale.
        const expected = baseline[SCALING_LABEL] * scale
        if (expected > 1) {
            expect(
                px[SCALING_LABEL],
                `at map zoom ${mapZoom} the opted-out label rendered at ${px[SCALING_LABEL]}px, expected ≈${expected}px`
            ).toBeGreaterThan(expected * 0.5)
        }

        // The claim that holds at every stop, measurable or not: the two
        // labels diverge in the predicted direction, from the same broadcast,
        // in the same frame. Below the anchor the opted-out label is smaller;
        // above it, larger; at the anchor the two models agree.
        if (scale < 1) {
            expect(
                px[SCALING_LABEL],
                `at map zoom ${mapZoom} the opted-out label (${px[SCALING_LABEL]}px) should be smaller than the resistant one (${px[RESISTANT_LABEL]}px)`
            ).toBeLessThan(px[RESISTANT_LABEL])
        } else if (scale > 1) {
            expect(
                px[SCALING_LABEL],
                `at map zoom ${mapZoom} the opted-out label (${px[SCALING_LABEL]}px) should be larger than the resistant one (${px[RESISTANT_LABEL]}px)`
            ).toBeGreaterThan(px[RESISTANT_LABEL])
        }
    }
})

test('toggling one label re-scales only that label, with no zoom', async ({
    page,
}) => {
    await openMapBase(page, [
        geoTextRecord(RESISTANT_ID, RESISTANT_LABEL, null),
        geoTextRecord(SCALING_ID, SCALING_LABEL, null),
    ])
    await page.locator(`text=${RESISTANT_LABEL}`).first().waitFor({
        timeout: 15_000,
    })
    await page.locator(`text=${SCALING_LABEL}`).first().waitFor({
        timeout: 15_000,
    })

    const labels = [RESISTANT_LABEL, SCALING_LABEL]
    // Park the camera well away from the anchor so counter-scaling is doing
    // visible work; then never move it again.
    const CAMERA = Math.pow(2, -5)
    const before = await heightsAt(page, CAMERA, labels)

    // What applyProperty dispatches when the switch is turned off. Going
    // through the event (rather than clicking) is deliberate: this is the
    // frozen-props path the feature hinges on, and it is what undo/redo
    // replays too.
    await page.evaluate((id) => {
        window.dispatchEvent(
            new CustomEvent('geoTextResistChanged', {
                detail: { id, resist: 0 },
            })
        )
    }, SCALING_ID)

    const after = await page.evaluate((labels) => {
        const nodes = Array.from(document.querySelectorAll('text'))
        const out = {}
        labels.forEach((label) => {
            const el = nodes.find((n) => n.textContent === label)
            out[label] = el ? el.getBoundingClientRect().height : null
        })
        return out
    }, labels)

    // The toggled label collapsed to world scale immediately — no zoom gesture.
    expect(
        after[SCALING_LABEL],
        `toggled label stayed at ${after[SCALING_LABEL]}px (was ${before[SCALING_LABEL]}px) — the resist change never reached the element`
    ).toBeLessThan(before[SCALING_LABEL] / 2)

    // ...and the other label, which heard the same broadcast, did not move.
    expect(
        after[RESISTANT_LABEL],
        `the untouched label moved from ${before[RESISTANT_LABEL]}px to ${after[RESISTANT_LABEL]}px — the toggle is leaking across records`
    ).toBeCloseTo(before[RESISTANT_LABEL], 1)
})
