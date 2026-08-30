// First visit to the map base: "Where are you mapping?"
//
// The prompt offers two doors — the browser's own location, or a place search —
// and neither is forced. What these tests hold is the part that is easy to
// regress and impossible for a user to diagnose:
//
//   1. The choice comes FIRST. The search box used to be the whole dialog; it
//      is now behind door two, so a user who just wants "here" never types.
//   2. A refused location is not a dead end. Denial settles the base on the
//      timezone city AND leaves the dialog open, because the browser said no,
//      not the user.
//   3. Every outcome persists an anchor, and the anchor survives a reload of
//      `/` even with nothing drawn. That last clause is the subtle one: the
//      local base id normally rides along in the DRAFT, which does not exist
//      until the user draws — so answering the prompt and refreshing used to
//      mint a new base id and ask the very same question again.

import { test, expect } from './helpers/test.js'
import { setupLocalBase } from './helpers/index.js'

/** Elland Road, Leeds — a fix nowhere near any timezone-city fallback. */
const FIX = { latitude: 53.7778, longitude: -1.5722 }

/**
 * Wait out the modal's entrance before touching it.
 *
 * Modal's content transitions in with `transition-delay: 150ms`, so for the
 * first beat it sits stationary at `translateY(100px)` — which Playwright's
 * stability check reads as "settled". It clicks, the button slides out from
 * under the cursor mid-flight, and the click lands on the content wrapper
 * instead. A human cannot hit that window; a test hits it every run.
 */
async function waitForModalReady(page) {
    await page.waitForSelector('.modal-portal .active', { timeout: 10_000 })
    await page.waitForFunction(
        () => {
            const el = document.querySelector('.modal-portal .modal-content')
            if (!el) return false
            const now = el.getBoundingClientRect().top
            const prev = window.__cbModalTop
            window.__cbModalTop = now
            return prev !== undefined && Math.abs(now - prev) < 0.5
        },
        undefined,
        { polling: 'raf', timeout: 10_000 }
    )
}

/**
 * Open the map base from a local base at `/`.
 *
 * `expectPrompt: false` for the revisit case, where the whole point is that no
 * dialog appears — waiting for one there would fail on the correct behaviour.
 */
async function switchToMap(page, { expectPrompt = true } = {}) {
    await page.click('[aria-label="Switch base"]')
    await page.click('[role="option"]:has-text("Map")')
    await page.waitForSelector('#cb-map-bg', { timeout: 20_000 })
    if (expectPrompt) await waitForModalReady(page)
}

/**
 * Wait until an anchor has actually been committed, then return it.
 *
 * The write goes through the base-type provider and its saveConfig, so it lands
 * a tick or two after the dialog closes — reading straight after the close
 * races it.
 */
async function waitForStoredAnchor(page) {
    await page.waitForFunction(
        () => {
            const prefix = 'craftbase_base_type_'
            for (let i = 0; i < localStorage.length; i += 1) {
                const key = localStorage.key(i)
                if (!key || !key.startsWith(prefix)) continue
                try {
                    if (JSON.parse(localStorage.getItem(key))?.mapAnchor) {
                        return true
                    }
                } catch (_) {}
            }
            return false
        },
        undefined,
        { timeout: 15_000 }
    )
    return readStoredAnchor(page)
}

/** The anchor this base has settled on, as the app itself stores it. */
async function readStoredAnchor(page) {
    return page.evaluate(() => {
        const prefix = 'craftbase_base_type_'
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i)
            if (!key || !key.startsWith(prefix)) continue
            try {
                const parsed = JSON.parse(localStorage.getItem(key))
                if (parsed?.mapAnchor) return parsed.mapAnchor
            } catch (_) {}
        }
        return null
    })
}

/** Make getCurrentPosition fail the way a refused permission does. */
async function denyGeolocation(page) {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'geolocation', {
            configurable: true,
            value: {
                getCurrentPosition: (_ok, fail) => {
                    fail({ code: 1, message: 'User denied Geolocation' })
                },
                watchPosition: () => 0,
                clearWatch: () => {},
            },
        })
    })
}

test.describe('the map start-location prompt', () => {
    test('offers the choice before the search box', async ({ page }) => {
        await setupLocalBase(page)
        await switchToMap(page)

        // Both doors, and no search field yet.
        await expect(
            page.getByRole('button', { name: /Use my current location/ })
        ).toBeVisible()
        await expect(
            page.getByRole('button', { name: /No, let me search/ })
        ).toBeVisible()
        await expect(
            page.getByLabel('Search for a place to start from')
        ).toHaveCount(0)

        // Door two reveals the original flow.
        await page.getByRole('button', { name: /No, let me search/ }).click()
        await expect(
            page.getByLabel('Search for a place to start from')
        ).toBeVisible()
    })

    test('a granted location anchors the base on the fix', async ({
        page,
        context,
    }) => {
        await context.grantPermissions(['geolocation'])
        await context.setGeolocation(FIX)
        await setupLocalBase(page)
        await switchToMap(page)

        await page.getByRole('button', { name: /Use my current location/ }).click()

        // Answering closes the dialog...
        await expect(
            page.getByRole('button', { name: /Skip, use/ })
        ).toHaveCount(0, { timeout: 20_000 })

        // ...and the base is anchored on the fix, not on a timezone guess.
        const anchor = await waitForStoredAnchor(page)
        expect(anchor).toBeTruthy()
        expect(anchor.lngLat[0]).toBeCloseTo(FIX.longitude, 3)
        expect(anchor.lngLat[1]).toBeCloseTo(FIX.latitude, 3)
    })

    test('a denied location explains itself and keeps the dialog open', async ({
        page,
    }) => {
        await denyGeolocation(page)
        await setupLocalBase(page)
        await switchToMap(page)

        await page.getByRole('button', { name: /Use my current location/ }).click()

        // Explained in the user's terms, not as an error...
        await expect(page.getByText(/location is off/)).toBeVisible({
            timeout: 20_000,
        })
        // ...the search stays available, so the refusal costs nothing...
        await expect(
            page.getByLabel('Search for a place to start from')
        ).toBeVisible()
        // ...and the base is settled anyway, so it is never left anchor-less.
        expect(await waitForStoredAnchor(page)).toBeTruthy()
    })

    test('an answered base is not asked again after a reload', async ({
        page,
        context,
    }) => {
        await context.grantPermissions(['geolocation'])
        await context.setGeolocation(FIX)
        await setupLocalBase(page)
        await switchToMap(page)

        await page.getByRole('button', { name: /Use my current location/ }).click()
        await expect(
            page.getByRole('button', { name: /Skip, use/ })
        ).toHaveCount(0, { timeout: 20_000 })

        const before = await waitForStoredAnchor(page)

        // Reload with NOTHING drawn — the case that used to mint a fresh local
        // base id, orphan the anchor, and re-ask.
        await page.goto('/')
        await page.waitForSelector('#main-two-root svg', { timeout: 15_000 })
        await switchToMap(page, { expectPrompt: false })
        await page.waitForTimeout(2500)

        await expect(
            page.getByRole('button', { name: /Skip, use/ })
        ).toHaveCount(0)
        expect(await readStoredAnchor(page)).toEqual(before)
    })

    test('dismissing settles on the timezone city and stops asking', async ({
        page,
    }) => {
        await setupLocalBase(page)
        await switchToMap(page)

        await page.getByRole('button', { name: /Skip, use/ }).click()
        await expect(
            page.getByRole('button', { name: /Skip, use/ })
        ).toHaveCount(0)

        // Declining is a decision: it persists an anchor, which is what retires
        // the prompt rather than leaving it "unanswered" forever.
        expect(await waitForStoredAnchor(page)).toBeTruthy()
    })
})
