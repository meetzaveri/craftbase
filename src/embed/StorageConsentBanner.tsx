import type { ReactElement } from 'react'

interface StorageConsentBannerProps {
    onAllow: () => void
    onDecline: () => void
}

// Small, non-blocking card centered at the bottom of the board. The canvas
// stays usable while it's open; until the user answers, the board lives in
// memory only.
const StorageConsentBanner = ({
    onAllow,
    onDecline,
}: StorageConsentBannerProps): ReactElement => (
    <div
        role="dialog"
        aria-label="Save this board in your browser?"
        className="absolute bottom-16 left-0 right-0 z-20 flex justify-center pointer-events-none px-3"
    >
        <div className="pointer-events-auto max-w-sm w-full bg-card-bg border border-border-panel rounded-lg shadow-lg p-3 text-left">
            <p className="text-sm text-ink font-medium mb-1">
                Save this board in your browser?
            </p>
            <p className="text-xs text-ink-muted mb-3 leading-relaxed">
                Your drawing stays on this device, so it survives a refresh. If
                you say no, it is kept only until you leave the page.
            </p>
            <div className="flex justify-end gap-2">
                <button
                    type="button"
                    className="px-3 py-1.5 text-xs rounded-md text-ink-mid hover:bg-accent/30 transition-colors"
                    onClick={onDecline}
                >
                    No thanks
                </button>
                <button
                    type="button"
                    className="px-3 py-1.5 text-xs rounded-md bg-accent text-ink font-medium hover:bg-accent-dark transition-colors"
                    onClick={onAllow}
                >
                    Allow
                </button>
            </div>
        </div>
    </div>
)

export default StorageConsentBanner
