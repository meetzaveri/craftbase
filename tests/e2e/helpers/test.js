import { test as base, expect } from '@playwright/test'

// Single source of truth for per-action waits. CI runs against a remote Netlify
// deploy preview (network latency + production build + slower runner), so the
// 5s that's plenty locally is too tight there. Override per-run with
// E2E_WAIT_TIMEOUT if a specific environment needs more headroom.
const CI = !!process.env.CI
export const DEFAULT_TIMEOUT =
    Number(process.env.E2E_WAIT_TIMEOUT) || (CI ? 15_000 : 5_000)

/**
 * Netlify injects a "Deploy Preview" drawer widget into every preview build.
 * On an `isMobile: true` viewport it renders as a bar over the toolbar, and its
 * iframe wins the hit test: Playwright's call log shows it intercepting pointer
 * events until the action times out. It cost `mobile-modal-responsive` and
 * `tooltip-touch` five tests, and it cannot reproduce locally because nothing
 * injects it there.
 *
 * Hide it rather than block its request: the failure is a DOM hit test, so the
 * iframe still has to be gone from the layout even if it never loads. The
 * `[data-netlify-deploy-id]` wrapper is the element named in that call log.
 */
async function hideNetlifyDrawer(page) {
    await page.addInitScript(() => {
        const inject = () => {
            const style = document.createElement('style')
            style.textContent =
                'iframe[title="Netlify Drawer"],[data-netlify-deploy-id]' +
                '{display:none!important;pointer-events:none!important}'
            ;(document.head || document.documentElement).appendChild(style)
        }
        // Init scripts run before page scripts, but head may not exist yet.
        if (document.documentElement) inject()
        else document.addEventListener('DOMContentLoaded', inject, { once: true })
    })
}

// Extend the built-in `page` fixture so every spec inherits the default
// timeout for page/locator methods (waitForFunction, waitForSelector,
// locator.waitFor). expect() assertions read `expect.timeout` from the config
// instead — both are bumped together for CI.
export const test = base.extend({
    page: async ({ page }, use) => {
        page.setDefaultTimeout(DEFAULT_TIMEOUT)
        await hideNetlifyDrawer(page)
        await use(page)
    },
})

export { expect }
