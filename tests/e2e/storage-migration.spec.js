// One-shot localStorage migration for the board → base rename.
//
// This is the highest-risk path in the rename: a user who drew a canvas on the
// previous build must open the new one and find their work intact. Everything
// else in the rename is compile-checked; this is the only part where a mistake
// silently destroys user data instead of failing loudly.
//
// Mirrors src/utils/storageMigration.ts. Seeds the PRE-rename shape, loads the
// app, and asserts the post-rename shape.

import { test, expect } from './helpers/test.js'

const BASE_ID = '11111111-1111-1111-1111-111111111111'

/**
 * Exactly what the previous build would have left in localStorage.
 *
 * Seeds once per browser context. Playwright re-runs init scripts on every
 * navigation, and re-seeding the legacy shape after the migration has already
 * stamped its version would be skipped by the version guard — which is correct
 * product behaviour (a payload written by an old tab after the new build has
 * migrated is the multi-tab skew case), but it is not what these tests measure.
 */
function seedLegacyStorage(id) {
    if (localStorage.getItem('__seeded')) return
    localStorage.setItem('__seeded', '1')
    localStorage.setItem('userId', 'test-user-id')
    localStorage.setItem('craftbase_welcome_dismissed', '1')

    localStorage.setItem(
        'craftbase_local_draft',
        JSON.stringify({
            boardId: id,
            components: {
                'seed-0': {
                    id: 'seed-0',
                    componentType: 'rectangle',
                    boardId: id,
                    boardName: 'my board',
                    x: 10,
                    y: 20,
                    width: 40,
                    height: 40,
                    fill: '#f4f4f2',
                    stroke: '#000',
                    linewidth: 1,
                    position: 0,
                },
            },
            timestamp: Date.now(),
        })
    )
    localStorage.setItem(
        `craftbase_base_${id}`,
        JSON.stringify({
            base: 'map',
            mapAnchor: { lngLat: [72.87, 19.07], zoom: 11 },
            savedAt: Date.now(),
        })
    )
    localStorage.setItem('craftbase_background_board_id', id)
    localStorage.setItem('lastOpenBoard', id)
    localStorage.setItem(`tabs_open_${id}`, '1')
    // Untouched by the migration — asserted below so a future over-eager sweep
    // can't quietly start deleting things it shouldn't.
    localStorage.setItem(
        `craftbase_viewport_${id}`,
        JSON.stringify({ scale: 2, tx: 5, ty: 6, savedAt: Date.now() })
    )
    localStorage.setItem('craftbase_saved_colors', '["#ff0000"]')
}

async function mockGraphql(page) {
    await page.route('**/v1/graphql', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: {} }),
        })
    )
}

async function dumpStorage(page) {
    return page.evaluate(() => ({ ...localStorage }))
}

test.describe('localStorage migration (board → base)', () => {
    test('migrates a pre-rename profile and preserves the draft', async ({
        page,
    }) => {
        await mockGraphql(page)
        await page.addInitScript(seedLegacyStorage, BASE_ID)
        await page.goto('/')
        await page.waitForSelector('#main-two-root svg', { timeout: 15_000 })

        const store = await dumpStorage(page)

        // Version stamped.
        expect(store['craftbase_storage_version']).toBe('2')

        // Base-type key moved, and `base` reshaped to `type`.
        expect(store[`craftbase_base_${BASE_ID}`]).toBeUndefined()
        const baseType = JSON.parse(store[`craftbase_base_type_${BASE_ID}`])
        expect(baseType.type).toBe('map')
        expect(baseType.base).toBeUndefined()
        expect(baseType.mapAnchor).toEqual({ lngLat: [72.87, 19.07], zoom: 11 })

        // Background id key renamed, value carried over.
        expect(store['craftbase_background_board_id']).toBeUndefined()
        expect(store['craftbase_background_base_id']).toBe(BASE_ID)

        // Draft keeps its key; contents speak the new vocabulary.
        const draft = JSON.parse(store['craftbase_local_draft'])
        expect(draft.baseId).toBe(BASE_ID)
        expect(draft.boardId).toBeUndefined()
        const record = draft.components['seed-0']
        expect(record.baseId).toBe(BASE_ID)
        expect(record.baseName).toBe('my board')
        expect(record.boardId).toBeUndefined()
        expect(record.boardName).toBeUndefined()
        // The drawing itself is untouched.
        expect(record.x).toBe(10)
        expect(record.componentType).toBe('rectangle')

        // Dead key swept. `tabs_open_*` is deliberately left alone — it is a
        // live multi-tab counter the app rewrites on boot, not dead weight.
        expect(store['lastOpenBoard']).toBeUndefined()

        // Keys that never carried the token must survive untouched.
        expect(JSON.parse(store[`craftbase_viewport_${BASE_ID}`]).scale).toBe(2)
        expect(store['craftbase_saved_colors']).toBe('["#ff0000"]')
    })

    test('is idempotent across a reload', async ({ page }) => {
        await mockGraphql(page)
        await page.addInitScript(seedLegacyStorage, BASE_ID)
        await page.goto('/')
        await page.waitForSelector('#main-two-root svg', { timeout: 15_000 })
        const first = await dumpStorage(page)

        await page.reload()
        await page.waitForSelector('#main-two-root svg', { timeout: 15_000 })
        const second = await dumpStorage(page)

        expect(second['craftbase_storage_version']).toBe('2')
        expect(JSON.parse(second[`craftbase_base_type_${BASE_ID}`]).type).toBe(
            'map'
        )
        expect(
            JSON.parse(second['craftbase_local_draft']).components['seed-0']
                .baseId
        ).toBe(BASE_ID)
        expect(second[`craftbase_base_type_${BASE_ID}`]).toBe(
            first[`craftbase_base_type_${BASE_ID}`]
        )
    })

    test('a corrupt entry does not stop the app booting', async ({ page }) => {
        await mockGraphql(page)
        await page.addInitScript((id) => {
            localStorage.setItem('userId', 'test-user-id')
            localStorage.setItem('craftbase_welcome_dismissed', '1')
            localStorage.setItem(`craftbase_base_${id}`, '{not json')
            localStorage.setItem('craftbase_local_draft', 'also not json')
            localStorage.setItem('craftbase_background_board_id', id)
        }, BASE_ID)
        await page.goto('/')

        // The canvas still mounts.
        await page.waitForSelector('#main-two-root svg', { timeout: 15_000 })

        const store = await dumpStorage(page)
        // Version still advances, so the bad entry isn't retried forever.
        expect(store['craftbase_storage_version']).toBe('2')
        // The unparseable entries are dropped rather than left to poison later
        // reads. (The background id goes too: useLocalDraftPersistence clears
        // it alongside a draft it could not parse, which predates this rename.)
        expect(store[`craftbase_base_${BASE_ID}`]).toBeUndefined()
        expect(store['craftbase_background_board_id']).toBeUndefined()
    })
})
