// Shareable map bases.
//
// A map base's ink is meaningless without its georeference: surface (0,0) IS
// the base's anchor lng/lat, and elements store surface pixels. Before these
// tests' feature, that anchor lived only in the author's localStorage, so a
// recipient fell back to a guess made from THEIR timezone and every pin landed
// in the wrong city — while the shared base itself arrived typed 'board',
// which hides every geo object anyway.
//
// So there are two separate things to prove: the geography is carried on the
// base row, and the recipient's camera opens on the shared view — once.

import { test, expect } from './helpers/test.js'
import { baseRow, GQL_MOCK_RESPONSES } from './helpers/index.js'

const BASE_ID = '11111111-1111-1111-1111-111111111111'

// Elland Road, Leeds — the worked example from the feature request.
const ANCHOR = { lngLat: [-1.5722, 53.7778], zoom: 16 }
const LANDING = { lngLat: [-1.582, 53.7801], zoom: 17 }

// The shared table already answers the component-type catalog and the whole
// share path (createBase / insertBulkComponents / updateBaseVisibility); this
// spec only overrides the base row per test.
const GQL_BASE_MOCKS = GQL_MOCK_RESPONSES

/** A pin on the map — geo objects are what a shared map is actually made of. */
const point = (id, x, y) => ({
    id,
    componentType: 'point',
    objectClass: 'geo',
    children: null,
    metadata: { content: 'The Old Peacock' },
    x, x1: 0, x2: 0, y, y1: 0, y2: 0,
    fill: '#e5484d', width: 10, height: 10,
    iconStroke: null, stroke: '#e5484d', linewidth: 2, strokeType: null,
    textColor: '#3A342C', opacity: 1, position: 1,
    tailShapeId: null, tailEdge: null, headShapeId: null, headEdge: null,
    tailPortIndex: null, headPortIndex: null,
})

/**
 * Serve a persisted base whose row describes a shared map, and record every
 * GraphQL request so the write path can be asserted on.
 */
async function mockBase(page, { base, components = [] } = {}) {
    const requests = []
    await page.route('**/v1/graphql', async (route) => {
        let data = {}
        try {
            const body = JSON.parse(route.request().postData() || '{}')
            requests.push(body)
            data =
                body.operationName === 'getComponentsForBase'
                    ? { base, components }
                    : (GQL_BASE_MOCKS[body.operationName] ?? {})
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
    return requests
}

/** The live ZUI camera, via the dev-only handle newCanvas exposes. */
const readCamera = () => ({
    scale: window.__cbTwo?.scene?.scale ?? null,
    tx: window.__cbTwo?.scene?.translation?.x ?? null,
    ty: window.__cbTwo?.scene?.translation?.y ?? null,
})

/** What the app itself thinks the landing camera should be — same math, in-page. */
async function expectedCamera(page, anchor, landing) {
    return page.evaluate(
        async ([a, l]) => {
            const m = await import('/src/baseTypes/mercator.ts')
            const scale = m.scaleForMapZoom(l.zoom, a)
            const { x, y } = m.lngLatToSurface(l.lngLat, a)
            const two = window.__cbTwo
            const vw = two.width || window.innerWidth
            const vh = two.height || window.innerHeight
            return { scale, tx: vw / 2 - x * scale, ty: vh / 2 - y * scale }
        },
        [anchor, landing]
    )
}

test.describe('a shared map lands the recipient on the shared spot', () => {
    test('first open uses the base row, not the origin', async ({ page }) => {
        await mockBase(page, {
            base: baseRow({ id: BASE_ID, type: 'map', anchor: ANCHOR, landing: LANDING }),
        })
        await page.goto(`/map/${BASE_ID}`)
        await page.waitForSelector('#main-two-root svg', { timeout: 15_000 })
        await page.waitForTimeout(1200)

        const expected = await expectedCamera(page, ANCHOR, LANDING)
        const actual = await page.evaluate(readCamera)

        // Sub-pixel: this is the same arithmetic, so any drift is a real
        // difference in how the camera was applied, not rounding.
        expect(Math.abs(actual.scale - expected.scale)).toBeLessThan(1e-6)
        expect(Math.abs(actual.tx - expected.tx)).toBeLessThan(1)
        expect(Math.abs(actual.ty - expected.ty)).toBeLessThan(1)
        // And emphatically not the identity camera it would sit at otherwise.
        expect(actual.scale).not.toBe(1)
    })

    test('a second visit keeps the recipient’s own camera', async ({ page }) => {
        await mockBase(page, {
            base: baseRow({ id: BASE_ID, type: 'map', anchor: ANCHOR, landing: LANDING }),
        })
        await page.goto(`/map/${BASE_ID}`)
        await page.waitForSelector('#main-two-root svg', { timeout: 15_000 })
        await page.waitForTimeout(1000)

        // Move the camera and let the debounced save-as-you-go writer run.
        await page.evaluate(() => {
            window.__cbTwo.scene.translation.x -= 400
            window.__cbTwo.update()
        })
        const moved = await page.evaluate(() => {
            const vp = {
                scale: window.__cbTwo.scene.scale,
                tx: window.__cbTwo.scene.translation.x,
                ty: window.__cbTwo.scene.translation.y,
                savedAt: Date.now(),
            }
            localStorage.setItem(
                `craftbase_viewport_${'11111111-1111-1111-1111-111111111111'}__map`,
                JSON.stringify(vp)
            )
            return vp
        })

        await page.reload()
        await page.waitForSelector('#main-two-root svg', { timeout: 15_000 })
        await page.waitForTimeout(1000)

        const after = await page.evaluate(readCamera)
        expect(Math.abs(after.tx - moved.tx)).toBeLessThan(1)
        expect(Math.abs(after.ty - moved.ty)).toBeLessThan(1)
    })

    test('the landing seeds only this device’s viewport key', async ({ page }) => {
        await mockBase(page, {
            base: baseRow({ id: BASE_ID, type: 'map', anchor: ANCHOR, landing: LANDING }),
        })
        await page.goto(`/map/${BASE_ID}`)
        await page.waitForSelector('#main-two-root svg', { timeout: 15_000 })
        await page.waitForTimeout(1000)

        const keys = await page.evaluate(() =>
            Object.keys(localStorage).filter((k) => k.includes('viewport'))
        )
        // tx/ty are pixel translations computed against THIS viewport, so
        // copying them under the other form factor's key would be a wrong pan.
        expect(keys).toContain(`craftbase_viewport_${BASE_ID}__map`)
        expect(keys.some((k) => k.startsWith('craftbase_mobile_viewport_'))).toBe(false)
    })

    test('a row missing its geography falls back, it does not half-apply', async ({
        page,
    }) => {
        // Anchor but no landing: written together, so this is a hand-edited row.
        await mockBase(page, {
            base: baseRow({ id: BASE_ID, type: 'map', anchor: ANCHOR, landing: null }),
        })
        await page.goto(`/map/${BASE_ID}`)
        await page.waitForSelector('#main-two-root svg', { timeout: 15_000 })
        await page.waitForTimeout(1000)

        const camera = await page.evaluate(readCamera)
        expect(camera.scale).toBe(1)
        expect(camera.tx).toBe(0)
        expect(camera.ty).toBe(0)
    })
})

test.describe('the /map route', () => {
    test('pins the base type and hides the switcher', async ({ page }) => {
        await mockBase(page, {
            base: baseRow({ id: BASE_ID, type: 'map', anchor: ANCHOR, landing: LANDING }),
        })
        await page.goto(`/map/${BASE_ID}`)
        await page.waitForSelector('#main-two-root svg', { timeout: 15_000 })
        await page.waitForTimeout(800)

        // The URL names the type, so a switcher could only make it lie.
        await expect(page.locator('#cb-base-switcher')).toHaveCount(0)
        // Still a working canvas, not a stripped-down viewer.
        await expect(page.locator('#cb-shapes-toolbar')).toHaveCount(1)
        // Place search is map-base chrome, so its presence proves the pin took.
        await expect(page.locator('#cb-map-bg')).toHaveCount(1)
    })

    test('/base/:id on a map base canonicalizes to /map/:id', async ({ page }) => {
        await mockBase(page, {
            base: baseRow({ id: BASE_ID, type: 'map', anchor: ANCHOR, landing: LANDING }),
        })
        await page.goto(`/base/${BASE_ID}?vx=1&vy=2&vs=3`)
        await page.waitForSelector('#main-two-root svg', { timeout: 15_000 })

        await expect(page).toHaveURL(new RegExp(`/map/${BASE_ID}`))
        await page.waitForTimeout(1000)

        // The query string has to survive the hop, or a link shared before this
        // feature loses its viewport hand-off in transit. It is not still IN the
        // URL — the canvas consumes vx/vy/vs once and strips them by design — so
        // the proof is that the camera honoured it: an explicit param view
        // outranks the row's landing view, being the more specific request.
        const camera = await page.evaluate(readCamera)
        expect(camera.scale).toBeCloseTo(3, 5)
        expect(camera.tx).toBeCloseTo(1, 5)
        expect(camera.ty).toBeCloseTo(2, 5)
    })

    test('a board base is left on /base/:id', async ({ page }) => {
        await mockBase(page, { base: baseRow({ id: BASE_ID, type: 'board' }) })
        await page.goto(`/base/${BASE_ID}`)
        await page.waitForSelector('#main-two-root svg', { timeout: 15_000 })
        await page.waitForTimeout(500)

        await expect(page).toHaveURL(new RegExp(`/base/${BASE_ID}`))
        await expect(page.locator('#cb-base-switcher')).toHaveCount(1)
    })

    test('share and place search do not overlap on a map base', async ({ page }) => {
        await mockBase(page, {
            base: baseRow({ id: BASE_ID, type: 'map', anchor: ANCHOR, landing: LANDING }),
        })
        await page.goto(`/map/${BASE_ID}`)
        await page.waitForSelector('#main-two-root svg', { timeout: 15_000 })
        await page.waitForTimeout(1000)

        const share = await page.locator('#cb-share-button').boundingBox()
        const search = await page.locator('input[type="text"]').first().boundingBox()
        expect(share).not.toBeNull()
        expect(search).not.toBeNull()
        // They share the top-right corner; the search field measures the share
        // button and stops short of it.
        const disjoint =
            search.x + search.width <= share.x + 1 ||
            share.x + share.width <= search.x + 1
        expect(disjoint).toBe(true)
        expect(share.x + share.width).toBeLessThanOrEqual(
            page.viewportSize().width + 1
        )
    })
})

test.describe('sharing a map stamps its geography on the base row', () => {
    // Switching to the map pulls the ~1MB maplibre chunk, which pushes this
    // past the default per-test budget on a cold dev server.
    test.setTimeout(90_000)

    test('createBase carries the type, the anchor and the landing view', async ({
        page,
        context,
    }) => {
        const requests = await mockBase(page, { base: null })
        await page.goto('/')
        await page.waitForSelector('#main-two-root svg', { timeout: 15_000 })

        // Draw something first: Share refuses an empty canvas.
        await page.click('[aria-label="Rectangle / Square"]')
        await page.mouse.move(400, 300)
        await page.mouse.down()
        await page.mouse.move(560, 420, { steps: 8 })
        await page.mouse.up()
        await page.waitForTimeout(300)

        // Switch to the map and let the (~1MB) maplibre chunk land — sharing
        // before it does is exactly what the button's readiness guard prevents.
        await page.click('[aria-label="Switch base"]')
        await page.click('[role="option"]:has-text("Map")')
        await page.waitForSelector('#cb-map-bg', { timeout: 20_000 })

        // First visit to a map base asks where to start. Skipping accepts the
        // timezone city as the anchor — which is precisely the case that used to
        // break sharing: that anchor was never persisted anywhere, so a
        // recipient re-derived a different one from their own timezone.
        // It renders only once the provider state flips to 'map', a beat after
        // the container appears — so wait for the button itself, then confirm
        // the portal actually emptied before touching anything behind it.
        await page.waitForFunction(
            () =>
                Array.from(document.querySelectorAll('.modal-portal button')).some(
                    (b) => (b.textContent || '').includes('Skip, use')
                ),
            { timeout: 20_000 }
        )
        await page.getByRole('button', { name: /Skip, use/ }).click()
        await page
            .getByRole('button', { name: /Skip, use/ })
            .waitFor({ state: 'detached', timeout: 10_000 })
        await page.waitForTimeout(1500)

        context.on('page', (p) => void p.close().catch(() => {}))
        await page.click('#cb-share-button')
        await page.click('button:has-text("Yes, share")')
        await page.waitForTimeout(1500)

        // ensureBackgroundBase fires its own createBase on the first canvas
        // mutation, so the share-time call is the LAST one.
        const createBase = requests
            .filter((r) => r.operationName === 'createBase')
            .at(-1)
        expect(createBase).toBeTruthy()
        const object = createBase.variables.object

        // Without the type, the row takes the 'board' default and the recipient
        // opens a whiteboard with every geo object hidden.
        expect(object.type).toBe('map')

        // The georeference. Elements store surface pixels measured against it,
        // so a null here is the difference between pins on Elland Road and pins
        // in whatever city the recipient's timezone suggests.
        expect(Number.isFinite(object.mapAnchorLng)).toBe(true)
        expect(Number.isFinite(object.mapAnchorLat)).toBe(true)
        expect(Number.isFinite(object.mapAnchorZoom)).toBe(true)

        // The view to open on.
        expect(Number.isFinite(object.landingLng)).toBe(true)
        expect(Number.isFinite(object.landingLat)).toBe(true)
        expect(Number.isFinite(object.landingZoom)).toBe(true)

        // And it must be published, or the link is handed out on a private base.
        expect(
            requests.some((r) => r.operationName === 'updateBaseVisibility')
        ).toBe(true)

        // The link points at the map route.
        await expect(page.locator('text=/\\/map\\//')).toHaveCount(1)
    })

    test('a board base still shares as a board, with no geo columns', async ({
        page,
        context,
    }) => {
        const requests = await mockBase(page, { base: null })
        await page.goto('/')
        await page.waitForSelector('#main-two-root svg', { timeout: 15_000 })

        await page.click('[aria-label="Rectangle / Square"]')
        await page.mouse.move(400, 300)
        await page.mouse.down()
        await page.mouse.move(560, 420, { steps: 8 })
        await page.mouse.up()
        await page.waitForTimeout(300)

        context.on('page', (p) => void p.close().catch(() => {}))
        await page.click('#cb-share-button')
        await page.click('button:has-text("Yes, share")')
        await page.waitForTimeout(1200)

        // ensureBackgroundBase fires its own createBase on the first canvas
        // mutation, so the share-time call is the LAST one.
        const createBase = requests
            .filter((r) => r.operationName === 'createBase')
            .at(-1)
        expect(createBase).toBeTruthy()
        const object = createBase.variables.object
        expect(object.type).toBe('board')
        // A whiteboard has no geography; the columns stay null.
        expect(object.mapAnchorLng).toBeUndefined()
        expect(object.landingLng).toBeUndefined()
    })
})

test.describe('re-sharing an already-persisted base', () => {
    test('publishes it and refreshes the landing view', async ({ page, context }) => {
        // The base is reachable by URL but still private — exactly what the
        // storage-limit auto-persist produces. Sharing used to just copy the
        // URL here, handing out a link to a base that was never published.
        const requests = await mockBase(page, {
            base: baseRow({
                id: BASE_ID,
                type: 'map',
                isPublic: false,
                anchor: ANCHOR,
                landing: LANDING,
            }),
            components: [
                point('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 40, -30),
            ],
        })
        await page.goto(`/map/${BASE_ID}`)
        await page.waitForSelector('#main-two-root svg', { timeout: 15_000 })
        await page.waitForTimeout(1200)

        context.on('page', (p) => void p.close().catch(() => {}))
        await page.click('#cb-share-button')
        await page.click('button:has-text("Yes, share")')
        await page.waitForTimeout(1200)

        const shared = requests.find(
            (r) => r.operationName === 'sharePersistedBase'
        )
        expect(shared).toBeTruthy()
        expect(shared.variables.id).toBe(BASE_ID)
        // The landing view moves with the owner's current camera...
        expect(Number.isFinite(shared.variables.landingLng)).toBe(true)
        expect(Number.isFinite(shared.variables.landingZoom)).toBe(true)
        // ...but re-sharing must never mint a second base.
        expect(requests.some((r) => r.operationName === 'createBase')).toBe(false)
    })

    test('the recipient is not asked where they are mapping', async ({ page }) => {
        // The prompt gates on "this base has never settled on a place". A base
        // carrying a server anchor very much has — just not by this person.
        await mockBase(page, {
            base: baseRow({ id: BASE_ID, type: 'map', anchor: ANCHOR, landing: LANDING }),
        })
        await page.goto(`/map/${BASE_ID}`)
        await page.waitForSelector('#cb-map-bg', { timeout: 20_000 })
        await page.waitForTimeout(2500)

        await expect(
            page.getByRole('button', { name: /Skip, use/ })
        ).toHaveCount(0)
    })
})
