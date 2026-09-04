import { test, expect } from './helpers/test.js'
import { setupLocalBoard } from './helpers/index.js'

const TOAST = '[role="status"]'
const THRESHOLD = 2000

/**
 * Builds a local draft with `count` trivial rectangles, written straight to
 * localStorage so the board restores it on load — the "user refreshes an
 * already-large board" path, without drawing 2000 shapes by hand.
 */
function seedDraft(count) {
    const boardId = '11111111-1111-1111-1111-111111111111'
    const components = {}
    for (let i = 0; i < count; i++) {
        const id = `seed-${i}`
        components[id] = {
            id,
            componentType: 'rectangle',
            boardId,
            x: (i % 50) * 30,
            y: Math.floor(i / 50) * 30,
            width: 20,
            height: 20,
            fill: '#f4f4f2',
            stroke: '#000',
            linewidth: 1,
            position: i,
        }
    }
    return { boardId, components, timestamp: Date.now() }
}

test.describe('Element-count performance warning', () => {
    test('saved board over the threshold warns from the aggregate count', async ({
        page,
    }) => {
        // Registered AFTER setupLocalBoard: Playwright runs the most recently
        // added route first, so this sees the aggregate query and falls back to
        // the catch-all mock for everything else.
        await setupLocalBoard(page)
        await page.route('**/v1/graphql', async (route, request) => {
            const body = JSON.parse(request.postData() || '{}')
            if (body.operationName === 'getBoardComponentCount') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        data: { components: { aggregate: { count: 2500 } } },
                    }),
                })
                return
            }
            await route.fallback()
        })

        await page.goto('/board/22222222-2222-2222-2222-222222222222')

        await expect(page.locator(TOAST)).toBeVisible()
        await expect(page.locator(TOAST)).toContainText('2,000 elements')
    })

    test('saved board under the threshold does not warn', async ({ page }) => {
        await setupLocalBoard(page)
        await page.route('**/v1/graphql', async (route, request) => {
            const body = JSON.parse(request.postData() || '{}')
            if (body.operationName === 'getBoardComponentCount') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        data: { components: { aggregate: { count: 12 } } },
                    }),
                })
                return
            }
            await route.fallback()
        })

        await page.goto('/board/22222222-2222-2222-2222-222222222222')

        await expect(page.locator('#main-two-root svg')).toBeVisible()
        await expect(page.locator(TOAST)).toHaveCount(0)
    })

    test('local board restored over the threshold warns on refresh', async ({
        page,
    }) => {
        await setupLocalBoard(page)
        const draft = seedDraft(THRESHOLD + 1)
        await page.addInitScript((d) => {
            localStorage.setItem('craftbase_local_draft', JSON.stringify(d))
        }, draft)

        await page.goto('/')

        await expect(page.locator(TOAST)).toBeVisible({ timeout: 30000 })
    })

    test('the warning auto-hides after 15s', async ({ page }) => {
        test.setTimeout(60000)
        await setupLocalBoard(page)
        const draft = seedDraft(THRESHOLD + 1)
        await page.addInitScript((d) => {
            localStorage.setItem('craftbase_local_draft', JSON.stringify(d))
        }, draft)

        await page.goto('/')

        await expect(page.locator(TOAST)).toBeVisible({ timeout: 30000 })
        // Still up well before the deadline...
        await page.waitForTimeout(10000)
        await expect(page.locator(TOAST)).toBeVisible()
        // ...and gone after it.
        await expect(page.locator(TOAST)).toHaveCount(0, { timeout: 10000 })
    })

    test('local board under the threshold does not warn', async ({ page }) => {
        await setupLocalBoard(page)
        const draft = seedDraft(10)
        await page.addInitScript((d) => {
            localStorage.setItem('craftbase_local_draft', JSON.stringify(d))
        }, draft)

        await page.goto('/')

        await expect(page.locator('#main-two-root svg')).toBeVisible()
        await expect(page.locator(TOAST)).toHaveCount(0)
    })
})
