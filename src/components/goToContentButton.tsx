import type { ReactElement } from 'react'
import { useBoardContext } from '../views/Board/boardContext'

// Bottom-center pill that frames all elements into view (zoom-to-fit). A safety
// net for boards that load showing empty space — content drawn far from the
// origin, or a stale/seeded viewport pointing at emptiness. Hidden when the
// board has no elements (nothing to go to). Complements the auto-fit-on-load,
// which only fires when no content is visible; this button always works.
const GoToContentButton = (): ReactElement | null => {
    const { fitToContent, componentStore } = useBoardContext()

    // Only on a URL-loaded board (/board/:id) — not the local home board (`/`),
    // which lands on deliberately-placed content and needs no rescue. Matches
    // the auto-fit-on-load scoping in newCanvas.
    const isUrlBoard =
        typeof window !== 'undefined' &&
        window.location.pathname.startsWith('/board/')
    if (!isUrlBoard) return null

    const hasContent = Object.keys(componentStore ?? {}).length > 0
    if (!hasContent) return null

    return (
        <button
            onClick={(): void => {
                fitToContent()
            }}
            style={{
                position: 'fixed',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10,
            }}
            className="flex items-center gap-1.5 bg-card-bg text-ink-muted hover:text-ink rounded-lg px-3 py-1.5 border border-border-panel hover:bg-accent transition-colors duration-150 text-xs font-medium select-none"
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
