// Fire the board's Delete key programmatically.
//
// Deleting is spread across four owners, each listening for the same keydown:
// the selection controller (rect/circle/diamond/text), the focus-based handlers
// on arrow / plain line / divider / geoText, the orphan handler in newCanvas
// (curvedLine / route / area / point), and groupobject for a multi-element
// selection. They already guard each other against double-deletes.
//
// So the mobile delete button synthesises the key rather than adding a fifth
// delete path. A new path would have to re-implement four teardown routines —
// including groupobject's, which works around the `scene.subtractions` hazard in
// CLAUDE.md — and would then drift from the keyboard behaviour it is meant to
// mirror. Pressing the key is exactly what the button means.

/** Legacy `keyCode` for Delete. Every handler on the board switches on this. */
const DELETE_KEY_CODE = 46

/**
 * Dispatch a Delete keydown at `target` (falling back to the window).
 *
 * Aim it at the SELECTED ELEMENT'S SVG node, not at the button: the arrow, line,
 * divider, geoText and group handlers are bound to their own node and only fire
 * when the event passes through it. The event bubbles, so the window-level
 * listeners still see it either way.
 */
export function dispatchDeleteKey(target?: EventTarget | null): void {
    const event = new KeyboardEvent('keydown', {
        key: 'Delete',
        code: 'Delete',
        bubbles: true,
        cancelable: true,
    })
    // `keyCode`/`which` are legacy read-only getters — the constructor's init
    // dictionary ignores them, so they must be shimmed on. Without this they
    // read 0 and every handler ignores the event.
    Object.defineProperty(event, 'keyCode', { get: () => DELETE_KEY_CODE })
    Object.defineProperty(event, 'which', { get: () => DELETE_KEY_CODE })
    ;(target ?? window).dispatchEvent(event)
}
