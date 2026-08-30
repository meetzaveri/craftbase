// `/board/:id` → `/base/:id`.
//
// Every link shared before the board → base rename points at `/board/<uuid>`.
// The uuid still resolves — the migration renamed the table, not the rows — so
// the only thing standing between those links and a 404 is the redirect route
// in App.tsx. It is three lines, which is exactly why it needs a test: it is
// easy to delete by accident and nothing else in the suite touches it.

import { test, expect } from './helpers/test.js'

const BASE_ID = '11111111-1111-1111-1111-111111111111'

const rect = (id, x, y) => ({
    id,
    componentType: 'rectangle',
    objectClass: null,
    children: null,
    metadata: {},
    x, x1: 100, x2: 400, y, y1: 100, y2: 100,
    fill: '#f4f4f2', width: 200, height: 150,
    iconStroke: null, stroke: '#000', linewidth: 2, strokeType: null,
    textColor: '#000', opacity: 1, position: 1,
    tailShapeId: null, tailEdge: null, headShapeId: null, headEdge: null,
    tailPortIndex: null, headPortIndex: null,
})

async function setup(page) {
    const mocks = {
        getComponentTypes: {
            componentTypes: [
                { label: 'rectangle', width: 120, height: 120, fill: '#f4f4f2', textColor: '#000', metadata: {}, logo: null },
            ],
        },
        updateUserRevisitCount: {
            update_users_user_revisits_by_pk: { count: 1, user_id: 'test-user-id' },
        },
        getComponentsForBase: {
            // base: null keeps this a board base, so /base/:id does not
            // canonicalize onward to /map/:id.
            base: null,
            components: [rect('22222222-2222-2222-2222-222222222222', 150, 150)],
        },
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

test.describe('legacy /board/:id redirect', () => {
    test('rewrites the path to /base/:id, preserving the id', async ({
        page,
    }) => {
        await setup(page)
        await page.goto(`/board/${BASE_ID}`)
        await page.waitForURL(`**/base/${BASE_ID}`, { timeout: 15_000 })
        expect(new URL(page.url()).pathname).toBe(`/base/${BASE_ID}`)
    })

    test('the redirected base actually loads its components', async ({
        page,
    }) => {
        await setup(page)
        await page.goto(`/board/${BASE_ID}`)
        await page.waitForSelector('#main-two-root svg', { timeout: 15_000 })
        // The id survived the redirect and was used to fetch — so the element
        // from getComponentsForBase is on the canvas.
        await expect(page.locator('[data-component-id]')).toHaveCount(1)
    })

    test('replaces history so Back does not bounce through the dead path', async ({
        page,
    }) => {
        await setup(page)
        await page.goto('/')
        await page.waitForSelector('#main-two-root svg', { timeout: 15_000 })

        await page.goto(`/board/${BASE_ID}`)
        await page.waitForURL(`**/base/${BASE_ID}`, { timeout: 15_000 })

        // `replace` means the /board/ entry never entered history: one Back
        // lands on `/`, not on the legacy path that would redirect forward again.
        await page.goBack()
        await expect
            .poll(() => new URL(page.url()).pathname, { timeout: 10_000 })
            .toBe('/')
    })
})
