import { test, expect } from './helpers/test.js'
import {
    setupLocalBoard,
    drawPencilStroke,
    setDefaultStrokeWidth,
    clickToolbarButton,
    getCanvasBox,
} from './helpers/index.js'

// The Defaults panel's Stroke Width labels (see src/components/sidebar/defaults.js)
// map 1:1 to the linewidth value stored on the drawn component.
const DEFAULT_LABEL = '4'
const EXPECTED_LINEWIDTH = '4'

/**
 * Each shape component stamps `data-linewidth` on its SVG group at mount
 * (alongside `data-component-id`). We assert against this attribute rather
 * than the rendered `stroke-width`: pencil's per-path stroke-width is
 * velocity-modulated (see velocityToLinewidth in utils/pencilHelper.js), so
 * the SVG attr won't equal the chosen base. The component-level linewidth
 * field, however, is exactly the user-selected default — that's what we test.
 */
async function getLinewidth(handle) {
    return handle.getAttribute('data-linewidth')
}

test.describe('Default stroke width applies to drawn shapes', () => {
    test.beforeEach(async ({ page }) => {
        await setupLocalBoard(page)
    })

    // NOTE: the rectangle/circle/arrow cases that set the default stroke width
    // from an *idle* empty canvas were removed — `resolveSetKey` now hides the
    // property panel when nothing is selected and no draw mode is active (the
    // canvas-first welcome UX), so that flow no longer exists. The pencil case
    // below stays valid because entering pencil mode surfaces the panel.

    test('drawn pencil stroke uses default stroke width', async ({ page }) => {
        // Pencil shares the unified `defaultLinewidth` with shapes/arrows.
        // Enter pencil mode so the toolbar is available, then click the
        // stroke-width swatch — the next pencil stroke picks it up.
        await clickToolbarButton(page, 'Pencil')
        await setDefaultStrokeWidth(page, DEFAULT_LABEL)

        const box = await getCanvasBox(page)
        const cx = box.x + box.width * 0.65
        const cy = box.y + box.height * 0.65

        const handle = await drawPencilStroke(page, {
            startX: cx - 80,
            startY: cy - 30,
            endX: cx + 80,
            endY: cy + 30,
        })

        expect(await getLinewidth(handle)).toBe(EXPECTED_LINEWIDTH)
    })
})
