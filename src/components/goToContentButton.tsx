import type { ReactElement } from 'react'
import { useBaseContext } from '../views/Base/baseContext'
import { isUrlBasePath } from '../utils/baseRoutes'

// Bottom-center pill that frames all elements into view (zoom-to-fit). A safety
// net for bases that load showing empty space — content drawn far from the
// origin, or a stale/seeded viewport pointing at emptiness. Hidden when the
// base has no elements (nothing to go to). Complements the auto-fit-on-load,
// which only fires when no content is visible; this button always works.
const GoToContentButton = (): ReactElement | null => {
    const { fitToContent, componentStore } = useBaseContext()

    // Only on a URL-loaded base (/base/:id, /map/:id) — not the local home base
    // (`/`), which lands on deliberately-placed content and needs no rescue.
    // Matches the auto-fit-on-load scoping in newCanvas; both ask the same
    // question through the same helper so a new base route can't teach one
    // about itself and not the other.
    if (!isUrlBasePath()) return null

    const hasContent = Object.keys(componentStore ?? {}).length > 0
    if (!hasContent) return null

    return (
        <button
            onClick={(): void => {
                fitToContent()
            }}
            // Desktop keeps the bottom-centre pill. Mobile moves it under the
            // top bar, because at the bottom it landed straight on top of the
            // shapes toolbar (both centred around y≈790-828 on a 390x844
            // screen) and swallowed taps meant for the pencil and eraser.
            //
            // Top-centre is the same slot on both base types: the map base puts
            // the place-search field there and the board base the base-type
            // switcher, and every control in that row sits at `top: 8px` and
            // 46px tall (see placeSearch.tsx / baseTypeSwitcher.tsx), so
            // 54 + an 8px gap clears whichever one is showing.
            className="fixed left-1/2 -translate-x-1/2 z-10 top-[62px] tablet:top-auto tablet:bottom-5 flex items-center gap-1.5 bg-card-bg text-ink-muted hover:text-ink rounded-lg px-3 py-1.5 border border-border-panel hover:bg-accent transition-colors duration-150 text-xs font-medium select-none"
            title="Frame all content in view"
        >
            {/* Crosshair / recenter glyph — currentColor follows the theme. */}
            <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <circle cx="12" cy="12" r="3" />
                <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
            </svg>
            Go to content
        </button>
    )
}

export default GoToContentButton
