import { test, expect } from './helpers/test.js'
import { setupLocalBoard, placeText, getCanvasBox } from './helpers/index.js'

// Regression: pasting a bulleted list from a rich-text source (Docs/Notion/
// Notes) into the canvas text editor must keep the bullet markers. The editor
// is a plain <textarea> whose native paste only takes `text/plain` — and most
// sources omit the bullet glyphs there — so a `paste` handler rebuilds them
// from the `text/html` flavor.

function safeArea(box) {
    return { cx: box.x + box.width * 0.65, cy: box.y + box.height * 0.6 }
}

const lineCountOf = (handle) => handle.$$eval('text', (ns) => ns.length)

test.describe('Rich-text paste into canvas text', () => {
    test.beforeEach(async ({ page }) => {
        await setupLocalBoard(page)
    })

    test('pasting an HTML list keeps bullet markers', async ({ page }) => {
        const box = await getCanvasBox(page)
        const { cx, cy } = safeArea(box)
        const handle = await placeText(page, { x: cx, y: cy })

        const editor = page.locator('.temp-input-area')
        await editor.waitFor({ state: 'visible' })
        await editor.focus()

        // Dispatch a synthetic `paste` carrying the `text/html` flavor directly
        // on the textarea instead of writing to the system clipboard and
        // pressing Meta+v. Headless CI runners don't reliably populate
        // event.clipboardData from the OS clipboard on a keyboard paste (the
        // test passed locally but flaked on the deploy preview with the
        // unchanged placeholder), whereas a constructed ClipboardEvent feeds
        // the handler deterministically — and the handler reading text/html is
        // exactly the behaviour under test.
        await page.evaluate(() => {
            const html =
                '<meta charset="utf-8"><ul>' +
                '<li>First item</li>' +
                '<li>Second item<ul><li>Nested one</li></ul></li>' +
                '<li>Third item</li>' +
                '</ul>'
            const input = document.querySelector('.temp-input-area')
            if (!input) throw new Error('text editor not found')
            input.focus()
            input.selectionStart = 0
            input.selectionEnd = input.value.length
            const data = new DataTransfer()
            data.setData('text/html', html)
            input.dispatchEvent(
                new ClipboardEvent('paste', {
                    clipboardData: data,
                    bubbles: true,
                    cancelable: true,
                })
            )
        })

        await expect
            .poll(() => editor.inputValue())
            .toBe('• First item\n• Second item\n  ◦ Nested one\n• Third item')

        await page.keyboard.press('Tab')
        await expect(editor).toHaveCount(0)

        // Four visual lines, each carrying its marker.
        await expect.poll(() => lineCountOf(handle)).toBe(4)
        const lines = await handle.$$eval('text', (ns) =>
            ns.map((n) => n.textContent)
        )
        expect(lines).toEqual([
            '• First item',
            '• Second item',
            '  ◦ Nested one',
            '• Third item',
        ])
    })
})
