// The board base — today's parchment canvas, expressed as a BaseProvider.
//
// Deliberately close to a no-op. The parchment fill and the (flag-gated) dot
// grid are CSS on `#main-two-root`'s svg, driven by `syncBackgroundToCamera` /
// `syncDotGridClass` inside newCanvas. Re-implementing that here would mean two
// owners for one backdrop, so this provider leaves it alone and exists purely so
// the board is *a* base like any other — which is what lets the switcher, the
// toolbar gating and the export path stay provider-agnostic.

import type { BaseHandle, BaseProvider } from './types'

const BOARD_HANDLE: BaseHandle = { id: 'board' }

export const boardBase: BaseProvider = {
    id: 'board',
    label: 'Board',

    mount: async () => BOARD_HANDLE,
    // No async state to report back — nothing to persist beyond `base` itself.

    // The dot grid already tracks the camera via newCanvas's own listener.
    syncCamera: () => {},

    hiddenTools: new Set<string>(),
    extraTools: [],
    homeTool: 'pointer',

    zoomStep: 0.2,

    // Null hands the export path back to its existing parchment + dot-grid
    // rendering, so board-base exports are byte-for-byte what they were before
    // bases existed.
    captureBackdrop: async () => null,

    unmount: () => {},
}

export default boardBase
