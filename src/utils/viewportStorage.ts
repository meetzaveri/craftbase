// Per-board, per-base viewport persistence.
//
// Each base is its own workspace, so it keeps its own camera: panning around a
// map must not drag the whiteboard's view with it, and vice versa. Switching
// bases therefore restores that base's last camera rather than carrying the
// current one across.
//
// Key shape: `craftbase_viewport_<boardId>` for the board base and
// `craftbase_viewport_<boardId>__<base>` for every other base. The board base
// deliberately keeps the *unsuffixed* legacy key, so viewports saved before
// bases existed still restore on the board — no migration, no reset.

import {
    VIEWPORT_KEY_PREFIX,
    MOBILE_VIEWPORT_KEY_PREFIX,
    VIEWPORT_TTL_MS,
} from '../constants/misc'
import { DEFAULT_BASE } from '../bases/types'
import type { BaseId } from '../bases/types'

export interface StoredViewport {
    scale: number
    tx: number
    ty: number
}

interface RawViewport extends StoredViewport {
    savedAt: number
}

/**
 * Storage key for a board's camera on a given base. Desktop and mobile keep
 * separate cameras (they have very different usable viewports), which is why
 * the prefix differs rather than the suffix.
 */
export function viewportKeyFor(
    boardId: string,
    base: BaseId,
    isMobile: boolean
): string {
    const prefix = isMobile ? MOBILE_VIEWPORT_KEY_PREFIX : VIEWPORT_KEY_PREFIX
    return base === DEFAULT_BASE
        ? `${prefix}${boardId}`
        : `${prefix}${boardId}__${base}`
}

/** Read a base's saved camera, or null when absent, expired or malformed. */
export function readViewport(
    boardId: string,
    base: BaseId,
    isMobile: boolean
): StoredViewport | null {
    if (!boardId) return null
    const key = viewportKeyFor(boardId, base, isMobile)
    try {
        const raw = localStorage.getItem(key)
        if (!raw) return null
        const parsed = JSON.parse(raw) as Partial<RawViewport>
        if (!parsed.savedAt || Date.now() - parsed.savedAt > VIEWPORT_TTL_MS) {
            localStorage.removeItem(key)
            return null
        }
        const { scale, tx, ty } = parsed
        if (
            !Number.isFinite(scale) ||
            !Number.isFinite(tx) ||
            !Number.isFinite(ty) ||
            (scale as number) <= 0
        ) {
            localStorage.removeItem(key)
            return null
        }
        return {
            scale: scale as number,
            tx: tx as number,
            ty: ty as number,
        }
    } catch {
        return null
    }
}

/** Persist a base's camera. Swallows quota/private-mode failures. */
export function writeViewport(
    boardId: string,
    base: BaseId,
    isMobile: boolean,
    viewport: StoredViewport
): void {
    if (!boardId) return
    try {
        localStorage.setItem(
            viewportKeyFor(boardId, base, isMobile),
            JSON.stringify({ ...viewport, savedAt: Date.now() })
        )
    } catch {
        // Losing a camera preference must never block the interaction.
    }
}

/** The camera a base opens on when it has nothing saved. */
export const IDENTITY_VIEWPORT: StoredViewport = { scale: 1, tx: 0, ty: 0 }
