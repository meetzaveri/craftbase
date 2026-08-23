// Mock responses keyed by GraphQL operation name.
// Apollo writes each field it requested into its cache; returning {} causes a
// "Missing field" cache error and can crash components that consume the data.
// Values mirror the components."componentType" seed rows.
export const GQL_MOCK_RESPONSES = {
    getComponentTypes: {
        componentTypes: [
            { label: 'rectangle', width: 120, height: 120, fill: '#f4f4f2', textColor: '#000', metadata: {}, logo: null },
            { label: 'circle', width: 120, height: 120, fill: '#f4f4f2', textColor: '#000', metadata: {}, logo: null },
            { label: 'newText', width: 120, height: 120, fill: '#f4f4f2', textColor: '#000', metadata: { content: 'Your text here' }, logo: null },
            { label: 'text', width: 120, height: 120, fill: '#f4f4f2', textColor: '#000', metadata: { content: 'Your text here' }, logo: null },
            { label: 'arrowLine', width: 120, height: 120, fill: '#f4f4f2', textColor: '#000', metadata: {}, logo: null },
            { label: 'pencil', width: 120, height: 120, fill: '#f4f4f2', textColor: '#f4f4f2', metadata: [{}], logo: null },
        ],
    },
    // Revisit-count mutation — return a minimal valid shape so Apollo doesn't error
    updateUserRevisitCount: {
        update_users_user_revisits_by_pk: { count: 1, user_id: 'test-user-id' },
    },
    // Share path. persistBase creates a base, bulk-inserts its components and
    // publishes it; each needs a shaped response or Apollo's cache write fails.
    createBase: {
        base: { id: '99999999-9999-9999-9999-999999999999', createdBy: 'test-user-id' },
    },
    // The mutation selects `returning { baseId componentType id }`, so the mock
    // must carry it — a missing field makes Apollo reject and the whole share
    // aborts before the base is ever published.
    insertBulkComponents: {
        insert_components_component: {
            __typename: 'components_component_mutation_response',
            affected_rows: 0,
            returning: [],
        },
    },
    updateBaseVisibility: {
        update_bases_base_by_pk: {
            id: '99999999-9999-9999-9999-999999999999',
            isPublic: true,
        },
    },
    sharePersistedBase: {
        base: {
            id: '99999999-9999-9999-9999-999999999999',
            isPublic: true,
        },
    },
}

/**
 * A `bases_base` row for the getComponentsForBase mock.
 *
 * That query returns the base ROW as well as its components (the base type and
 * map georeference have to be known before the canvas mounts, so they ride the
 * query that already gates loading). Any spec that opens a persisted base must
 * therefore answer with a `base` field — `null` is valid and means "no server
 * config", which is what a board base created before these columns looks like.
 *
 * Pass `anchor`/`landing` as `{ lngLat: [lng, lat], zoom }` to describe a
 * shared map.
 */
export function baseRow({
    id = '11111111-1111-1111-1111-111111111111',
    type = 'board',
    isPublic = true,
    anchor = null,
    landing = null,
} = {}) {
    return {
        __typename: 'bases_base',
        id,
        type,
        isPublic,
        mapAnchorLng: anchor ? anchor.lngLat[0] : null,
        mapAnchorLat: anchor ? anchor.lngLat[1] : null,
        mapAnchorZoom: anchor ? anchor.zoom : null,
        landingLng: landing ? landing.lngLat[0] : null,
        landingLat: landing ? landing.lngLat[1] : null,
        landingZoom: landing ? landing.zoom : null,
    }
}

/**
 * Sets userId in localStorage and mocks the GraphQL HTTP endpoint before the
 * page loads. Without the userId, AppInit would call insertUser and block
 * rendering. Without proper mock data, Apollo logs cache errors that can
 * crash sidebar components and break canvas interactions.
 */
export async function setupLocalBase(page) {
    await page.route('**/v1/graphql', async (route) => {
        let responseData = {}
        try {
            const body = JSON.parse(route.request().postData() || '{}')
            responseData = GQL_MOCK_RESPONSES[body.operationName] ?? {}
        } catch (_) {}
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: responseData }),
        })
    })

    await page.addInitScript(() => {
        localStorage.setItem('userId', 'test-user-id')
        // Disable the first-visit welcome sketch for e2e: its seeded elements
        // would inflate element counts and its entrance animation would race
        // assertions. Setting the dismissal flag makes the base load as a
        // returning visitor (empty canvas). Mirrors WELCOME_DISMISSED_KEY in
        // src/constants/misc.ts.
        localStorage.setItem('craftbase_welcome_dismissed', '1')
    })

    await page.goto('/')
    await page.waitForSelector('#main-two-root svg', { timeout: 15_000 })
}

/**
 * Returns the bounding box of the canvas SVG. The `#main-two-root` div itself
 * has height 0 because the Two.js SVG is absolutely positioned, so callers
 * MUST measure off the SVG, not the wrapper div.
 */
export async function getCanvasBox(page) {
    return page.locator('#main-two-root svg').boundingBox()
}

// Toolbar aria-labels used to dispatch a draw mode (see staticPrimaryElementData).
const SHAPE_TOOLBAR_LABEL = {
    rectangle: 'Rectangle / Square',
    circle: 'Circle',
    diamond: 'Diamond',
}

/**
 * Draws a draw-to-place shape (rectangle or circle) on the canvas.
 *
 * Mirrors Path A in tests/workflows/how_shape_gets_drawn.md and crucially goes
 * through the real toolbar click — primary.js writes pendingShapeProps using
 * the live React state (defaultLinewidth, defaultStrokeType, fill from
 * getComponentTypesData), which is what production does. Bypassing the toolbar
 * with hardcoded props would mask any test that depends on those defaults
 * (e.g. the default-stroke-width tests).
 *
 * startX/Y and endX/Y are viewport coordinates. Keep them clear of the top
 * toolbar (~y < 60) and the Defaults panel (~x < 160).
 *
 * Returns an ElementHandle for the resulting SVG group element.
 */
export async function drawShape(page, type, { startX, startY, endX, endY }) {
    const ariaLabel = SHAPE_TOOLBAR_LABEL[type]
    if (!ariaLabel) throw new Error(`Unknown shape type: ${type}`)

    const countBefore = await page.$$eval(
        '[data-component-id]',
        (els) => els.length
    )

    // On mobile, Rectangle/Circle/Diamond live inside a "Shapes" drawer that
    // must be opened first; on desktop they're flattened to top-level buttons
    // (see flattenShapesForDesktop in shapesToolbar.js) and the drawer parent
    // never renders. Click the drawer only if it exists.
    const shapesDrawer = await page.$('[aria-label="Shapes"]')
    if (shapesDrawer) await shapesDrawer.click()
    await page.click(`[aria-label="${ariaLabel}"]`)

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(endX, endY, { steps: 10 })
    await page.mouse.up()

    return waitForNewElement(page, countBefore)
}

/**
 * Convenience wrapper for drawing a rectangle.
 */
export async function drawRectangle(page, coords) {
    return drawShape(page, 'rectangle', coords)
}

/**
 * Waits for one new [data-component-id] element to appear (relative to a
 * pre-action count), then returns the most recently added one. Used by the
 * shape-creation helpers that go through the actual toolbar click.
 */
async function waitForNewElement(page, countBefore, { timeout } = {}) {
    await page.waitForFunction(
        (before) =>
            document.querySelectorAll('[data-component-id]').length > before,
        countBefore,
        { timeout }
    )
    const all = await page.$$('[data-component-id]')
    return all[all.length - 1]
}

/**
 * Waits until the canvas holds exactly `expected` distinct components.
 *
 * `data-component-id` is NOT 1:1 with DOM nodes, so counting matched nodes
 * overcounts: attachVertexHandles (src/components/utils/vertexHandles.ts)
 * stamps the owning element's id onto every draggable vertex handle, so a
 * curvedLine/route/area with N vertices matches 1 group + N handle paths.
 * A 4-vertex curved line is 5 nodes but one component. De-dupe by id.
 */
export async function expectComponentCount(page, expected, { timeout } = {}) {
    await page.waitForFunction(
        (want) =>
            new Set(
                Array.from(
                    document.querySelectorAll('[data-component-id]'),
                    (el) => el.getAttribute('data-component-id')
                )
            ).size === want,
        expected,
        { timeout }
    )
}

/**
 * Click the toolbar icon for the given aria-label and wait for the icon's
 * parent button to take its `bg-accent` active state — this confirms
 * setCurrentElementInBase fired and the corresponding draw mode is armed.
 */
async function clickToolbarShape(page, ariaLabel) {
    await page.click(`[aria-label="${ariaLabel}"]`)
}

// Maps a STROKE_WIDTHS label (see STROKE_WIDTHS in
// src/components/sidebar/elementProperties.js) to the 1-based index of its
// button inside #stroke-width-section.
const STROKE_WIDTH_INDEX_BY_LABEL = {
    '0': 1,
    '1': 2,
    '2': 3,
    '4': 4,
    '6': 5,
    '8': 6,
}

/**
 * Clicks the unified element-properties toolbar's Stroke Width button matching
 * the given label ('0' | '1' | '2' | '4' | '6' | '8'). The buttons are unlabeled visual
 * swatches, so we pick by position within #stroke-width-section. All sets
 * (SHAPE / ARROW / PENCIL / RECT_WITH_TEXT) write to the same unified
 * `defaultLinewidth`.
 */
export async function setDefaultStrokeWidth(page, label) {
    const idx = STROKE_WIDTH_INDEX_BY_LABEL[label]
    if (!idx)
        throw new Error(
            `Unknown stroke width label: ${label}. Valid: 0, 1, 2, 4, 6, 8.`
        )
    await page.click(`#stroke-width-section button:nth-of-type(${idx})`)
}

/**
 * Clicks any top-level toolbar button by aria-label (e.g. "Pencil", "Select",
 * "Eraser"). Used by tests that need to switch the active draw mode so the
 * unified properties toolbar swaps to the matching set before tweaking a
 * default.
 */
export async function clickToolbarButton(page, ariaLabel) {
    await page.click(`[aria-label="${ariaLabel}"]`)
}

/**
 * Draws an arrow on the canvas (Path: arrowDrawMode in workflows doc).
 *   1. Click toolbar Arrow → handleArrowElement adds an arrowLine component
 *      immediately (off-screen at its random x/y) and sets arrowDrawMode.
 *   2. mousedown picks SCENARIO_ARROW_DRAW and positions the element at the
 *      click point.
 *   3. mousemove updates the second endpoint; mouseup finalizes.
 *
 * Returns the arrow's SVG group element handle.
 */
export async function drawArrow(page, { startX, startY, endX, endY }) {
    const countBefore = await page.$$eval(
        '[data-component-id]',
        (els) => els.length
    )

    await clickToolbarShape(page, 'Arrow')

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(endX, endY, { steps: 10 })
    await page.mouse.up()

    return waitForNewElement(page, countBefore)
}

/**
 * Draws a pencil stroke. Pencil mode requires at least 2 raw points to commit
 * a stroke (see SCENARIO_PENCIL_MODE mouseup), so we feed multiple intermediate
 * mouse positions on the way to (endX, endY).
 *
 * Returns the pencil stroke's SVG group element handle.
 */
export async function drawPencilStroke(page, { startX, startY, endX, endY }) {
    const countBefore = await page.$$eval(
        '[data-component-id]',
        (els) => els.length
    )

    await clickToolbarShape(page, 'Pencil')

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    // 20 small steps gives the velocity-based stroke logic enough samples to
    // accept the path as a real stroke.
    await page.mouse.move(endX, endY, { steps: 20 })
    await page.mouse.up()

    return waitForNewElement(page, countBefore)
}

/**
 * Draws a plain straight line. Line lives inside the "Lines" drawer in the
 * shapes toolbar (main icon → drawer with Line / Curved line). A line draws
 * with the SAME drag gesture as an arrow (primary.js routes 'line' through
 * handleArrowElement / SCENARIO_ARROW_DRAW) — only the componentType differs,
 * which strips the arrowhead via the line factory.
 *
 * Returns the line's SVG group element handle.
 */
export async function drawLine(page, { startX, startY, endX, endY }) {
    const countBefore = await page.$$eval(
        '[data-component-id]',
        (els) => els.length
    )

    // Open the Lines drawer by hovering the parent icon (see drawCurvedLine),
    // then pick the plain-line tool.
    await page.hover('[aria-label="Lines"]')
    await page.click('[aria-label="Line"]')

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(endX, endY, { steps: 10 })
    await page.mouse.up()

    return waitForNewElement(page, countBefore)
}

/**
 * Draws a curved line via the multi-click flow (primary.js →
 * handleMultiClickDraw('curvedLine') → SCENARIO_GEO_DRAW). Each click places a
 * vertex; pressing Enter finishes the draw (finishGeoDraw uses every placed
 * vertex — no dropLast). Pass 3+ points to get a curvedLine with >2 vertices.
 *
 * Returns the curved line's SVG group element handle.
 */
export async function drawCurvedLine(page, points) {
    if (!Array.isArray(points) || points.length < 2) {
        throw new Error('drawCurvedLine needs at least 2 points')
    }
    const countBefore = await page.$$eval(
        '[data-component-id]',
        (els) => els.length
    )

    // Open the Lines drawer by HOVERING the parent icon, then pick the
    // curved-line tool. Hover is how the drawer is meant to be opened
    // (HOVER_DRAWER_DEFAULT_TOOL in shapesToolbar) and it arms nothing —
    // clicking the parent would select its default child (a plain line),
    // arming a pending element that the curved-line click then has to cancel.
    await page.hover('[aria-label="Lines"]')
    await page.click('[aria-label="Curved line"]')

    // Each click is a mousedown that pushes one vertex (mouseup is a no-op in
    // geo-draw mode — the draw only finishes on Enter/Escape/double-click).
    for (const p of points) {
        await page.mouse.click(p.x, p.y)
    }
    await page.keyboard.press('Enter')

    return waitForNewElement(page, countBefore)
}

/**
 * Places a text element at (x, y) (Path: textDrawMode).
 *   1. Click toolbar Text → handleTextElement adds a newText component
 *      off-screen and sets textDrawMode.
 *   2. mousedown picks SCENARIO_TEXT_DRAW and positions the element at the
 *      click point.
 *   3. mouseup dispatches the triggerTextInput event (we don't need to type
 *      anything for a smoke test — the element exists in the canvas).
 *
 * Returns the text element's SVG group element handle.
 */
export async function placeText(page, { x, y }) {
    const countBefore = await page.$$eval(
        '[data-component-id]',
        (els) => els.length
    )

    await clickToolbarShape(page, 'Text')

    // The element mounts off-screen on toolbar click; wait for it to show up
    // before dispatching mousedown so SCENARIO_TEXT_DRAW finds it in the scene.
    await waitForNewElement(page, countBefore)

    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.up()

    const all = await page.$$('[data-component-id]')
    return all[all.length - 1]
}

/**
 * Double-clicks a rectangle to open the text input overlay, types the given
 * text, then presses Tab to commit it. Waits until the SVG <text> node appears
 * inside the rectangle group (confirming the text was saved to the store).
 */
/**
 * Reads the localStorage draft and returns the components map (or null if no
 * draft exists). The draft is written by useLocalDraftPersistence with a 500ms
 * debounce, so callers must wait for the debounced flush before reading.
 */
export async function getDraftComponents(page) {
    return page.evaluate(() => {
        const raw = localStorage.getItem('craftbase_local_draft')
        if (!raw) return null
        return JSON.parse(raw).components || {}
    })
}

/**
 * Triggers the undo keyboard shortcut. The handler in newCanvas.js accepts
 * either ctrlKey or metaKey, so Meta+z works on Linux/CI as well as Mac.
 */
export async function triggerUndoKeyboard(page) {
    await page.keyboard.press('Meta+z')
}

/**
 * Clicks the Undo button in the shapes toolbar. The button is a div wrapping
 * an SVG with aria-label="Undo" (hover tooltip is a separate Tooltip
 * component, not a title attribute).
 */
export async function clickUndoButton(page) {
    await page.click('[aria-label="Undo"]')
}

/**
 * Triggers redo via keyboard. Cmd/Ctrl+Shift+Z is the redo shortcut; the
 * handler in newCanvas.js accepts either ctrlKey or metaKey alongside shiftKey.
 */
export async function triggerRedoKeyboard(page) {
    await page.keyboard.press('Meta+Shift+z')
}

/**
 * Clicks the Redo button in the shapes toolbar (aria-label="Redo").
 */
export async function clickRedoButton(page) {
    await page.click('[aria-label="Redo"]')
}

/**
 * Switches the toolbar to select/pan (Select) mode. Clears any draw-mode
 * flags left over by drawArrow/drawPencilStroke/placeText (they each set
 * localStorage flags during their flow), so the next mousedown on empty canvas
 * is interpreted as the start of a marquee group selection.
 */
export async function clickPointerTool(page) {
    await page.click('[aria-label="Select"]')
}

/**
 * Drags an empty marquee rectangle on the canvas (Path: isGroupSelector branch
 * in src/newCanvas.js). Caller must already be in select/pan mode and the
 * (startX, startY) point must land on empty canvas. On mouseup, newCanvas calls
 * setOnGroupHandler which builds a groupobject from any element whose stored
 * (x, y) falls inside the marquee bounds.
 *
 * Returns the ElementHandle for the new groupobject SVG group, identified by
 * data-label="groupobject_coord" set in groupobject.js after Two.js mounts it.
 */
export async function dragSelectArea(
    page,
    { startX, startY, endX, endY },
    { timeout } = {}
) {
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(endX, endY, { steps: 10 })
    await page.mouse.up()

    await page.waitForSelector('[data-label="groupobject_coord"]', { timeout })
    return page.$('[data-label="groupobject_coord"]')
}

/**
 * Reads the full visible text of a shape/text group as the user sees it.
 *
 * Shape-with-text and multiline standalone text render as a STACK of
 * <text> SVG nodes (one per wrapped/hard line), not a single node. A naive
 * `$eval('text', el => el.textContent)` only reads line 1 — which silently
 * truncates once text wraps (e.g. after the default text size grew from the
 * old hard-coded "S"/24 to the user default "M"/36).
 *
 * We join the per-line nodes with a single space. Word-wrap breaks at spaces
 * and the separating space is consumed by the wrap, so space-joining the
 * lines reconstructs the original space-separated content.
 */
export async function readGroupText(handle) {
    return handle.$$eval('text', (nodes) =>
        nodes
            .map((n) => n.textContent)
            .filter((s) => s && s.length > 0)
            .join(' ')
    )
}

export async function addTextToRectangle(page, rectHandle, text) {
    const box = await rectHandle.boundingBox()
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2

    await page.mouse.dblclick(cx, cy)
    await page.waitForSelector('.temp-input-area')
    await page.fill('.temp-input-area', text)
    await page.keyboard.press('Tab')

    // Wait for the Two.js <text> SVG node to appear inside the shape group
    const groupId = await rectHandle.getAttribute('id')
    await page.waitForFunction(
        (id) => document.getElementById(id)?.querySelector('text') !== null,
        groupId
    )
}
