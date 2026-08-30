// Modals have to fit a phone.
//
// The shared Modal (components/common/modal.tsx) capped its content box at
// `max-width: 80%` of the viewport, then took 20px of padding off each side.
// On a 390px screen that is 272px of usable width — narrower than the 400-440px
// minWidths every modal body declares, so the body overflowed its own rounded
// box: the buttons sat past the edge and the share URL was unreadable.
//
// The fix bounds the modal to the viewport and clamps each body's minWidth, so
// this spec asserts the invariant rather than any particular width: whatever
// the modal renders must fit on screen with nothing overflowing.

import { test, expect } from './helpers/test.js'
import { setupLocalBase, drawRectangle } from './helpers/index.js'

const SHARE_BUTTON = '#cb-share-button'

// Real phone widths, smallest still-supported screen first.
const PHONES = [
    { name: 'small phone', width: 320, height: 568 },
    { name: 'iPhone SE', width: 375, height: 667 },
    { name: 'iPhone 12', width: 390, height: 844 },
    { name: 'Pixel 7', width: 412, height: 915 },
]

for (const phone of PHONES) {
    test.describe(`${phone.name} (${phone.width}x${phone.height})`, () => {
        test.use({
            viewport: { width: phone.width, height: phone.height },
            hasTouch: true,
            isMobile: true,
        })

        test('the share modal fits the screen', async ({ page }) => {
            await setupLocalBase(page)
            // Share needs something on the canvas, or it shows the empty state.
            await drawRectangle(page, {
                startX: 150,
                startY: 300,
                endX: 250,
                endY: 380,
            })

            // dispatchEvent, not click: on a narrow viewport the "frame all
            // content" button overlaps the toolbar and intercepts the pointer.
            await page.locator(SHARE_BUTTON).first().dispatchEvent('click')
            await page.locator('.modal-content').waitFor()
            // Let the open transition settle before measuring.
            await page.waitForTimeout(500)

            const m = await page.evaluate(() => {
                const el = document.querySelector('.modal-content')
                const r = el.getBoundingClientRect()
                return {
                    left: r.left,
                    right: r.right,
                    top: r.top,
                    bottom: r.bottom,
                    scrollW: el.scrollWidth,
                    clientW: el.clientWidth,
                    vw: window.innerWidth,
                    vh: window.innerHeight,
                    buttons: Array.from(el.querySelectorAll('button')).map(
                        (b) => {
                            const br = b.getBoundingClientRect()
                            return {
                                label: b.textContent.trim(),
                                left: br.left,
                                right: br.right,
                            }
                        }
                    ),
                }
            })

            expect(m.left, 'modal overflows the left edge').toBeGreaterThanOrEqual(0)
            expect(m.right, 'modal overflows the right edge').toBeLessThanOrEqual(m.vw)
            expect(m.top, 'modal overflows the top edge').toBeGreaterThanOrEqual(0)
            expect(m.bottom, 'modal overflows the bottom edge').toBeLessThanOrEqual(m.vh)

            // The body must fit the box it is drawn in — this is what actually
            // broke, and it is invisible to a pure on-screen bounds check.
            expect(
                m.scrollW,
                'modal body is wider than the modal box'
            ).toBeLessThanOrEqual(m.clientW + 1)

            expect(m.buttons.length, 'modal should offer actions').toBeGreaterThan(0)
            for (const b of m.buttons) {
                expect(b.left, `"${b.label}" is off-screen left`).toBeGreaterThanOrEqual(0)
                expect(b.right, `"${b.label}" is off-screen right`).toBeLessThanOrEqual(m.vw)
            }
        })
    })
}
