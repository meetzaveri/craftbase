import { test as base, expect } from '@playwright/test'

// Single source of truth for per-action waits. CI runs against a remote Netlify
// deploy preview (network latency + production build + slower runner), so the
// 5s that's plenty locally is too tight there. Override per-run with
// E2E_WAIT_TIMEOUT if a specific environment needs more headroom.
const CI = !!process.env.CI
export const DEFAULT_TIMEOUT =
    Number(process.env.E2E_WAIT_TIMEOUT) || (CI ? 15_000 : 5_000)

// Hosts the umami tracker talks to: the script CDN and the event collector.
export const ANALYTICS_HOSTS = ['cloud.umami.is', 'gateway.umami.is']

// Analytics opt-out, applied to the whole context rather than a single page so
// it also covers pages a spec opens itself via context.newPage() or a popup —
// those never inherit a page-level fixture.
//
// Two independent guards:
//   1. The localStorage flag umami checks before sending, so the tracker
//      no-ops. addInitScript runs before the page's own scripts on every
//      navigation. localStorage throws on opaque origins, hence the try/catch.
//   2. A route abort, so nothing reaches the network even if the flag is ever
//      ignored (tracker rewrite, a second snippet added to index.html).
//
// playwright.config.js blocks the same hosts at the browser level as well.
// That is the layer covering a spec that imports `test` straight from
// @playwright/test and so never sees this fixture at all.
export const test = base.extend({
    context: async ({ context }, use) => {
        await context.addInitScript(() => {
            try {
                window.localStorage.setItem('umami.disabled', '1')
            } catch (e) {}
        })
        await context.route(
            (url) => ANALYTICS_HOSTS.includes(url.hostname),
            (route) => route.abort()
        )
        await use(context)
    },
    // Every spec inherits the default timeout for page/locator methods
    // (waitForFunction, waitForSelector, locator.waitFor). expect() assertions
    // read `expect.timeout` from the config instead — both are bumped together
    // for CI.
    page: async ({ page }, use) => {
        page.setDefaultTimeout(DEFAULT_TIMEOUT)
        await use(page)
    },
})

export { expect }
