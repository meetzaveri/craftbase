import type { ComponentStore } from '../types/board'
import { GROUP_COMPONENT, DRAFT_STORAGE_KEY } from '../constants/misc'
import { isWelcomeComponent } from './welcomeSketch'

/**
 * localStorage stores strings as UTF-16 (~2 bytes/char) and the per-origin
 * quota is ~5MB in most browsers. This budget is the write-side / load-side
 * ceiling (in UTF-16 bytes) — a proactive line kept near, but under, the real
 * quota so editing stays smooth and huge boards don't freeze on load.
 *
 * NOTE: this is a *storage footprint* (≈2× the on-disk file size), not the
 * file size. A 2.3MB `.json` export occupies ~4.6MB here.
 *
 * For the import gate we don't rely on this estimate at all — see
 * `draftFitsForStore`, which probes the browser's real quota. Tunable.
 */
export const MAX_DRAFT_BYTES = 5 * 1024 * 1024 // 5MB UTF-16 ≈ 2.5M JSON chars

/**
 * Write-side soft cap on the persisted draft, in REAL UTF-8 bytes (what
 * `TextEncoder` and the on-disk export file measure — not the UTF-16 storage
 * footprint). This is the number shown in the live readout.
 *
 * Keep it below the browser's real capacity so the guard reverts *before*
 * localStorage throws. Browsers vary (~2.5–4 MB of UTF-8 JSON before the
 * UTF-16 quota bites), so watch the live readout and tune this to your target.
 */
export const MAX_DRAFT_UTF8_BYTES = 3 * 1024 * 1024 // 3 MB UTF-8

/**
 * True UTF-8 byte size of the persisted draft as it sits in localStorage,
 * via TextEncoder. Matches the export file size, not the UTF-16 footprint.
 * Returns 0 when there is no draft.
 */
export function measureStoredDraftUtf8Bytes(): number {
    let raw: string | null = null
    try {
        raw = localStorage.getItem(DRAFT_STORAGE_KEY)
    } catch {
        raw = null
    }
    return raw ? new TextEncoder().encode(raw).length : 0
}

/**
 * The exact subset the draft actually persists — drops transient `groupobject`
 * records and onboarding welcome-sketch seeds. Mirrors the filter in
 * `useLocalDraftPersistence.writeDraft` so the measured size matches what
 * really gets written.
 */
export function selectPersistableComponents(
    store: ComponentStore
): ComponentStore {
    return Object.fromEntries(
        Object.entries(store).filter(
            ([, v]) =>
                v?.componentType !== GROUP_COMPONENT && !isWelcomeComponent(v)
        )
    ) as ComponentStore
}

/** Approximate the localStorage footprint (UTF-16 bytes) of a serialized string. */
export function measureBytes(serialized: string): number {
    return serialized.length * 2
}

/**
 * Test whether a store would actually fit in THIS browser's localStorage —
 * by probing the real quota, not an estimate. Since an import replaces the
 * current draft, we temporarily free the draft key, attempt to write the
 * projected draft to a scratch key, and always restore the original in
 * `finally`. Returns true if it fits.
 */
export function draftFitsForStore(store: ComponentStore): boolean {
    const persistable = selectPersistableComponents(store)
    if (Object.keys(persistable).length === 0) return true
    // Approximate the real save envelope; components dominate the size.
    const serialized = JSON.stringify({ components: persistable })

    const PROBE_KEY = '__craftbase_fit_probe__'
    let current: string | null = null
    try {
        current = localStorage.getItem(DRAFT_STORAGE_KEY)
    } catch {
        current = null
    }
    try {
        if (current != null) localStorage.removeItem(DRAFT_STORAGE_KEY)
        localStorage.setItem(PROBE_KEY, serialized)
        return true
    } catch {
        return false
    } finally {
        try {
            localStorage.removeItem(PROBE_KEY)
        } catch {
            /* ignore */
        }
        if (current != null) {
            try {
                localStorage.setItem(DRAFT_STORAGE_KEY, current)
            } catch {
                /* ignore — nothing we can do, original was already read */
            }
        }
    }
}

/** Read the raw persisted draft string without parsing/rendering it. */
export function readRawDraft(): string | null {
    try {
        return localStorage.getItem(DRAFT_STORAGE_KEY)
    } catch {
        return null
    }
}

/** True when an already-persisted draft is too large to safely render. */
export function isRawDraftOverBudget(raw: string): boolean {
    return measureBytes(raw) > MAX_DRAFT_BYTES
}

/**
 * Download the raw persisted draft as a file WITHOUT rendering it — the rescue
 * path for a board too large to open. Reads straight from localStorage so it
 * never mounts thousands of elements into Two.js (which is what freezes the
 * page in the first place).
 */
export function downloadRawDraftBackup(raw: string): void {
    const blob = new Blob([raw], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `craftbase-board-backup-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}
