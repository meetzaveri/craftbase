import { test, expect } from './helpers/test.js'

// Verifies board-load framing:
//  - /board/:id showing empty space (content far from origin) → auto-fit frames it.
//  - /board/:id whose camera already shows content → auto-fit leaves it alone.
//  - / (local board) → auto-fit never fires.
//  - "Go to content" button reframes on demand.

const BOARD_ID = '11111111-1111-1111-1111-111111111111'

const rect = (id, x, y) => ({
    id,
    componentType: 'rectangle',
    objectClass: null,
    children: null,
    metadata: {},
    x, x1: 100, x2: 400, y, y1: 100, y2: 100,
    fill: '#f4f4f2', width: 200, height: 150,
    iconStroke: null, stroke: '#000', linewidth: 2, strokeType: null,
    textColor: '#000', opacity: 1, position: id.charCodeAt(0),
    tailShapeId: null, tailEdge: null, headShapeId: null, headEdge: null,
    tailPortIndex: null, headPortIndex: null,
})

// Far from the origin and spanning larger than the viewport → off-screen at the
// default camera, so a fit must zoom out to reveal it.
const FAR_COMPONENTS = [
    rect('22222222-2222-2222-2222-222222222222', 4000, 3000),
    rect('33333333-3333-3333-3333-333333333333', 7000, 5000),
]

// Near the origin → visible at the default camera (scale 1, translate 0).
const NEAR_COMPONENTS = [
    rect('44444444-4444-4444-4444-444444444444', 120, 120),
    rect('55555555-5555-5555-5555-555555555555', 360, 260),
]

const mockGraphql = async (page, components) => {
    const mocks = {
        getComponentTypes: {
            componentTypes: [
                { label: 'rectangle', width: 120, height: 120, fill: '#f4f4f2', textColor: '#000', metadata: {}, logo: null },
            ],
        },
        updateUserRevisitCount: {
            update_users_user_revisits_by_pk: { count: 1, user_id: 'test-user-id' },
        },
        getComponentsForBoard: { components },
    }
    await page.route('**/v1/graphql', async (route) => {
        let data = {}
        try {
            const body = JSON.parse(route.request().postData() || '{}')
            data = mocks[body.operationName] ?? {}
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
}

const sceneScale = (page) =>
    page.evaluate(() => {
        const g = document
            .getElementById('main-two-root')
            ?.querySelector('svg > g')
        const m = (g?.getAttribute('transform') || '').match(/matrix\(([^)]+)\)/)
        if (!m) return null
        return m[1].split(/[ ,]+/).map(Number)[0]
    })

const firstElementVisible = async (page) => {
    const box = await page.locator('[data-component-id]').first().boundingBox()
    if (!box) return false
    const { width: vw, height: vh } = page.viewportSize()
    return box.x < vw && box.y < vh && box.x + box.width > 0 && box.y + box.height > 0
}

test.describe('Fit-to-content on board load', () => {
    test('frames far-away content when opening /board/:id', async ({ page }) => {
        await mockGraphql(page, FAR_COMPONENTS)
        await page.goto(`/board/${BOARD_ID}`)
        await page.waitForSelector('#main-two-root svg')
        // Generous waits: on a network-served prod build the element chunks load
        // lazily, so mounting + the geometry-settle can take a few seconds.
        await expect(page.locator('[data-component-id]')).toHaveCount(2, {
            timeout: 15000,
        })

        // Auto-fit brings the off-screen content into view and zooms out.
        await expect.poll(() => firstElementVisible(page), { timeout: 12000 }).toBe(true)
        const scale = await sceneScale(page)
        expect(scale).toBeLessThan(0.99)

        // The ZoomControls readout must reflect the fit, not a stale 100%.
        const pct = Math.round(scale * 100)
        expect(pct).toBeLessThan(100)
        await expect(
            page.getByText(new RegExp(`^${pct}%$`))
        ).toBeVisible()
    })

    test('rescues a stale saved viewport that shows empty space', async ({ page }) => {
        // Regression: the old gate skipped the fit whenever ANY viewport was
        // restored. Save-as-you-go writes one on every visit (30-day TTL), so a
        // revisit landing on emptiness never got rescued. Seed such a bad saved
        // viewport (zoomed in at the origin, far from the content) and assert the
        // fit still fires because no content is visible.
        await mockGraphql(page, FAR_COMPONENTS)
        await page.addInitScript((id) => {
            localStorage.setItem(
                `craftbase_viewport_${id}`,
                JSON.stringify({ tx: 0, ty: 0, scale: 2, savedAt: Date.now() })
            )
        }, BOARD_ID)
        await page.goto(`/board/${BOARD_ID}`)
        await page.waitForSelector('#main-two-root svg')
        await expect(page.locator('[data-component-id]')).toHaveCount(2, {
            timeout: 15000,
        })

        await expect.poll(() => firstElementVisible(page), { timeout: 12000 }).toBe(true)
        // Camera moved off the restored scale of 2 to frame the content.
        const scale = await sceneScale(page)
        expect(scale).toBeLessThan(0.99)
    })

    test('leaves the camera alone when content is already visible', async ({ page }) => {
        await mockGraphql(page, NEAR_COMPONENTS)
        await page.goto(`/board/${BOARD_ID}`)
        await page.waitForSelector('#main-two-root svg')
        await expect(page.locator('[data-component-id]')).toHaveCount(2, { timeout: 15000 })
        // Near-origin content is on-screen at the default camera → no fit.
        await page.waitForTimeout(6000)
        expect(await firstElementVisible(page)).toBe(true)
        const scale = await sceneScale(page)
        expect(Math.abs(scale - 1)).toBeLessThan(0.01)
    })

    test('does NOT fire on / (local board)', async ({ page }) => {
        await mockGraphql(page, NEAR_COMPONENTS)
        await page.goto('/')
        await page.waitForSelector('#main-two-root svg')
        await page.waitForTimeout(6000)
        const scale = await sceneScale(page)
        expect(scale).not.toBeNull()
        expect(Math.abs(scale - 1)).toBeLessThan(0.01)
    })

    test('"Go to content" button is hidden on / (local board)', async ({ page }) => {
        await mockGraphql(page, NEAR_COMPONENTS)
        await page.goto('/')
        await page.waitForSelector('#main-two-root svg')
        // Draw a shape so the board has content; the button must still stay
        // hidden because this is the local home board, not /board/:id.
        const box = await page.locator('#main-two-root svg').boundingBox()
        await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width * 0.6 + 120, box.y + box.height * 0.6 + 90)
        await page.mouse.up()
        await page.waitForTimeout(300)
        await expect(
            page.getByRole('button', { name: 'Go to content' })
        ).toHaveCount(0)
    })

    test('"Go to content" button reframes content into view', async ({ page }) => {
        await mockGraphql(page, NEAR_COMPONENTS)
        await page.goto(`/board/${BOARD_ID}`)
        await page.waitForSelector('#main-two-root svg')
        await expect(page.locator('[data-component-id]')).toHaveCount(2, { timeout: 15000 })

        const button = page.getByRole('button', { name: 'Go to content' })
        await expect(button).toBeVisible()

        // Content near the origin is not centered at the default camera. After
        // clicking, the fit should center the content bbox in the viewport.
        // Use dispatchEvent rather than click(): Netlify deploy previews inject a
        // bottom-anchored "Drawer" iframe that overlaps this bottom-center button
        // and intercepts pointer events. dispatchEvent fires the click directly
        // on the element (React's delegated onClick still runs), immune to the
        // overlay — which is a CI-only artifact, not part of the product.
        await button.dispatchEvent('click')
        await page.waitForTimeout(600)

        const { width: vw, height: vh } = page.viewportSize()
        const boxes = await page.locator('[data-component-id]').all()
        let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
        for (const b of boxes) {
            const r = await b.boundingBox()
            if (!r) continue
            left = Math.min(left, r.x)
            top = Math.min(top, r.y)
            right = Math.max(right, r.x + r.width)
            bottom = Math.max(bottom, r.y + r.height)
        }
        const cx = (left + right) / 2
        const cy = (top + bottom) / 2
        // Content bbox center lands near the viewport center (within 15%).
        expect(Math.abs(cx - vw / 2)).toBeLessThan(vw * 0.15)
        expect(Math.abs(cy - vh / 2)).toBeLessThan(vh * 0.15)
    })
})
