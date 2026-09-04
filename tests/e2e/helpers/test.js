import { test as base, expect } from '@playwright/test'

// Single source of truth for per-action waits. CI runs against a remote Netlify
// deploy preview (network latency + production build + slower runner), so the
// 5s that's plenty locally is too tight there. Override per-run with
// E2E_WAIT_TIMEOUT if a specific environment needs more headroom.
const CI = !!process.env.CI
export const DEFAULT_TIMEOUT =
    Number(process.env.E2E_WAIT_TIMEOUT) || (CI ? 15_000 : 5_000)

// Extend the built-in `page` fixture so every spec inherits the default
// timeout for page/locator methods (waitForFunction, waitForSelector,
// locator.waitFor). expect() assertions read `expect.timeout` from the config
// instead — both are bumped together for CI.
export const test = base.extend({
    page: async ({ page }, use) => {
        page.setDefaultTimeout(DEFAULT_TIMEOUT)
        await use(page)
    },
})

export { expect }
