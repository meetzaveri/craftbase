import { createHash } from 'node:crypto'
import { test, expect } from './helpers/test.js'
import { setupLocalBoard } from './helpers/index.js'

/**
 * Importing a board JSON that contains images.
 *
 * Shared boards (/board/:id) don't support images yet: image rows are never
 * persisted, so an imported image would render once and vanish on refresh.
 * The import flow must leave images out there (both "Open as new canvas" and
 * "Merge into current") and say so. Local mode (/) keeps them.
 */

const BOARD_ID = '66666666-6666-6666-6666-666666666666'
const IMAGE_GROUP = '[data-component-type="image"]'

const sharedRect = {
    id: '77777777-7777-7777-7777-777777777777',
    componentType: 'rectangle',
    objectClass: null,
    children: null,
    metadata: {},
    x: 300,
    x1: 100,
    x2: 400,
    y: 300,
    y1: 100,
    y2: 100,
    fill: '#f4f4f2',
    width: 120,
    height: 80,
    iconStroke: null,
    stroke: '#000',
    linewidth: 2,
    strokeType: null,
    textColor: '#000',
    opacity: 1,
    position: 1,
    tailShapeId: null,
    tailEdge: null,
    headShapeId: null,
    headEdge: null,
    tailPortIndex: null,
    headPortIndex: null,
}

// Shared board backed by mocked Hasura: one rectangle already on the board.
async function openSharedBoard(page) {
    const mocks = {
        getComponentTypes: {
            componentTypes: [
                {
                    label: 'rectangle',
                    width: 120,
                    height: 120,
                    fill: '#f4f4f2',
                    textColor: '#000',
                    metadata: {},
                    logo: null,
                },
            ],
        },
        updateUserRevisitCount: {
            update_users_user_revisits_by_pk: {
                count: 1,
                user_id: 'test-user-id',
            },
        },
        getComponentsForBoard: { components: [sharedRect] },
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
    await page.goto(`/board/${BOARD_ID}`)
    await page.waitForSelector(`[data-component-id="${sharedRect.id}"]`)
}

// A 1.1 export with one rectangle and `imageCount` images. The image records
// reference the PNG's SHA-256, which is how restoreImageAssets keys the bytes.
async function buildExport(page, { imageCount, withRect = true }) {
    const base64 = await page.evaluate(() => {
        const c = document.createElement('canvas')
        c.width = 200
        c.height = 120
        const ctx = c.getContext('2d')
        ctx.fillStyle = '#16a34a'
        ctx.fillRect(0, 0, 200, 120)
        return c.toDataURL('image/png').split(',')[1]
    })
    const assetId = createHash('sha256')
        .update(Buffer.from(base64, 'base64'))
        .digest('hex')
    const components = {}
    if (withRect) {
        components['88888888-8888-8888-8888-888888888888'] = {
            id: '88888888-8888-8888-8888-888888888888',
            componentType: 'rectangle',
            x: 200,
            y: 200,
            width: 120,
            height: 80,
            fill: '#f4f4f2',
            stroke: '#000',
            linewidth: 2,
            position: 1,
            metadata: {},
            children: {},
        }
    }
    for (let i = 0; i < imageCount; i++) {
        const id = `99999999-9999-9999-9999-99999999999${i}`
        components[id] = {
            id,
            componentType: 'image',
            x: 500 + i * 30,
            y: 300 + i * 30,
            width: 200,
            height: 120,
            fill: 'transparent',
            stroke: null,
            linewidth: null,
            position: 2 + i,
            children: {},
            metadata: {
                assetId,
                url: null,
                mimeType: 'image/png',
                naturalWidth: 200,
                naturalHeight: 120,
                opacity: 1,
            },
        }
    }
    return JSON.stringify({
        formatVersion: '1.1',
        components,
        assets: { [assetId]: `data:image/png;base64,${base64}` },
    })
}

async function pickImportFile(page, json) {
    await page.click('[title="Menu"]')
    await page.getByText('Import board').click()
    const [chooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.getByText('Import JSON').click(),
    ])
    await chooser.setFiles({
        name: 'board.json',
        mimeType: 'application/json',
        buffer: Buffer.from(json),
    })
}

test.describe('Importing images into a shared board', () => {
    test('"Open as new canvas" leaves images out and says so', async ({
        page,
    }) => {
        await openSharedBoard(page)
        await pickImportFile(page, await buildExport(page, { imageCount: 2 }))

        await expect(
            page.getByText('Found 1 element in this file.')
        ).toBeVisible()
        await expect(
            page.getByText(
                '2 images will be left out. Shared boards don’t support images yet.'
            )
        ).toBeVisible()

        await page.getByText('Open as new canvas').click()

        await expect(
            page.locator(
                '[data-component-id="88888888-8888-8888-8888-888888888888"]'
            )
        ).toHaveCount(1)
        // Give any (wrongly) imported image time to mount before asserting.
        await page.waitForTimeout(500)
        await expect(page.locator(IMAGE_GROUP)).toHaveCount(0)
    })

    test('"Merge into current" leaves images out and keeps the rest', async ({
        page,
    }) => {
        await openSharedBoard(page)
        const before = await page.locator('[data-component-id]').count()
        await pickImportFile(page, await buildExport(page, { imageCount: 1 }))

        await expect(
            page.getByText(
                '1 image will be left out. Shared boards don’t support images yet.'
            )
        ).toBeVisible()
        await page.getByText('Merge into current').click()

        // The existing rectangle plus the imported one, and no image.
        await expect(page.locator('[data-component-id]')).toHaveCount(
            before + 1
        )
        await page.waitForTimeout(500)
        await expect(page.locator(IMAGE_GROUP)).toHaveCount(0)
    })

    test('a file with only images is refused with a reason', async ({
        page,
    }) => {
        await openSharedBoard(page)
        await pickImportFile(
            page,
            await buildExport(page, { imageCount: 1, withRect: false })
        )

        await expect(
            page.getByText(
                "This file only has images. Shared boards don't support images yet."
            )
        ).toBeVisible()
        await expect(page.getByText('Open as new canvas')).toHaveCount(0)
    })
})

test.describe('Importing images into a local board', () => {
    test('images are kept and rendered', async ({ page }) => {
        await setupLocalBoard(page)
        await pickImportFile(page, await buildExport(page, { imageCount: 1 }))

        await expect(
            page.getByText('Found 2 elements in this file.')
        ).toBeVisible()
        await expect(page.getByText(/will be left out/)).toHaveCount(0)
        await page.getByText('Open as new canvas').click()

        await page.waitForSelector(`${IMAGE_GROUP} image[data-cb-image]`, {
            state: 'attached',
        })
        await expect(page.locator(IMAGE_GROUP)).toHaveCount(1)
    })
})
