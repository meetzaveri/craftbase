// Text is scoped to the base type it was authored on.
//
// Regression: text drawn on the board base stayed visible after switching to
// the map. It fell through every rule in `isRecordVisibleOnBaseType` to the
// catch-all `return true` — shapes are claimed by BOARD_ONLY_TYPES and geo
// objects by `objectClass`, but nothing claimed `newText`.
//
// The fix records the authoring base type per record
// (`metadata.baseTypeScope`, stamped in buildTextShapeData), which is also the
// rule that generalises to a future image base.

import { test, expect } from './helpers/test.js'
import { setupLocalBase, getCanvasBox } from './helpers/index.js'

/** Double-click empty canvas to create a text element, then type into it. */
async function createText(page, content) {
    const box = await getCanvasBox(page)
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await page.mouse.dblclick(x, y)
    await page.keyboard.type(content)
    await page.mouse.click(box.x + 40, box.y + 40) // blur to commit
    await page.waitForTimeout(300)
}

test.describe('text is scoped to its authoring base type', () => {
    test.beforeEach(async ({ page }) => {
        await setupLocalBase(page)
    })

    test('board-base text carries baseTypeScope: board', async ({ page }) => {
        await createText(page, 'hello board')
        await page.waitForTimeout(700) // draft debounce

        const scopes = await page.evaluate(() => {
            const raw = localStorage.getItem('craftbase_local_draft')
            if (!raw) return null
            const draft = JSON.parse(raw)
            return Object.values(draft.components || {})
                .filter((c) => c.componentType === 'newText')
                .map((c) => c.metadata?.baseTypeScope)
        })

        expect(scopes).not.toBeNull()
        expect(scopes.length).toBeGreaterThan(0)
        // Every text element records where it was authored.
        scopes.forEach((s) => expect(s).toBe('board'))
    })

    test('the visibility rule hides unscoped legacy newText on the map', async ({
        page,
    }) => {
        // Exercises the rule directly against a record shaped like one written
        // before `baseTypeScope` existed — the case a fresh-draw test cannot
        // produce any more, and the one users are actually carrying.
        const verdicts = await page.evaluate(async () => {
            const mod = await import('/src/utils/geoVisibility.ts')
            const legacyText = { componentType: 'newText', metadata: {} }
            const scopedToBoard = {
                componentType: 'newText',
                metadata: { baseTypeScope: 'board' },
            }
            const geoText = {
                componentType: 'geoText',
                objectClass: 'geo',
                metadata: {},
            }
            return {
                legacyOnBoard: mod.isRecordVisibleOnBaseType(
                    legacyText,
                    'board'
                ),
                legacyOnMap: mod.isRecordVisibleOnBaseType(legacyText, 'map'),
                scopedOnBoard: mod.isRecordVisibleOnBaseType(
                    scopedToBoard,
                    'board'
                ),
                scopedOnMap: mod.isRecordVisibleOnBaseType(
                    scopedToBoard,
                    'map'
                ),
                geoOnBoard: mod.isRecordVisibleOnBaseType(geoText, 'board'),
                geoOnMap: mod.isRecordVisibleOnBaseType(geoText, 'map'),
            }
        })

        // Board text belongs to the board base, both legacy and scoped.
        expect(verdicts.legacyOnBoard).toBe(true)
        expect(verdicts.legacyOnMap).toBe(false)
        expect(verdicts.scopedOnBoard).toBe(true)
        expect(verdicts.scopedOnMap).toBe(false)
        // Map text is the mirror image — the asymmetry that made this a bug.
        expect(verdicts.geoOnBoard).toBe(false)
        expect(verdicts.geoOnMap).toBe(true)
    })
})

// Regression: the scope rule was right, but the DOM disagreed with it.
//
// The inline text editor hides the <g> with an inline `display:none` while the
// textarea overlays it, and used to restore it with a hard-coded
// `display:block`. An inline style beats the `display` attribute Two.js writes
// from its own `.visible` flag — so switching to the map right after typing
// (the switcher click is what blurs the editor) left the board text painted
// over the map, even though `applyBaseTypeVisibility` had correctly set
// visible=false. A reload cleared it, which is what made it look like a
// persistence bug rather than a paint one.
test.describe('base switch right after typing text', () => {
    test.beforeEach(async ({ page }) => {
        await setupLocalBase(page)
    })

    test('board text is not painted on the map', async ({ page }) => {
        const box = await getCanvasBox(page)
        await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2)
        await page.waitForTimeout(400)
        await page.keyboard.type('hello board')

        // No blur click: switching IS the blur, which is the failing sequence.
        await page.click('[aria-label="Switch base"]')
        await page.click('[role="option"]:has-text("Map")')
        await page.waitForTimeout(1200)

        const painted = await page.evaluate(() =>
            Array.from(document.querySelectorAll('[data-component-id]')).map(
                (el) => ({
                    inlineDisplay: el.style.display,
                    computed: getComputedStyle(el).display,
                })
            )
        )

        expect(painted.length).toBeGreaterThan(0)
        painted.forEach((el) => {
            // The element component must not pin display inline — Two.js owns it.
            expect(el.inlineDisplay).toBe('')
            expect(el.computed).toBe('none')
        })
    })
})
