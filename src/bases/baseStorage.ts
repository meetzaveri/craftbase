// Per-board base persistence.
//
// Mirrors the viewport-key pattern (`craftbase_viewport_<boardId>`): one key per
// board, a `savedAt` stamp, and the shared TTL sweep in board.tsx. Two rules
// this module exists to enforce:
//
//   1. Absent or unreadable entry → DEFAULT_BASE. A board created before bases
//      existed has no key, so it opens on the board base, exactly as it always
//      did.
//   2. No write on read. Only an explicit user switch calls `writeBaseConfig`,
//      which keeps untouched boards byte-identical in localStorage.

import { BASE_KEY_PREFIX, VIEWPORT_TTL_MS } from '../constants/misc'
import { isBaseId } from './registry'
import { DEFAULT_BASE } from './types'
import type { BaseConfig, MapAnchor } from './types'

interface StoredBaseConfig extends BaseConfig {
    savedAt: number
}

function keyFor(boardId: string): string {
    return `${BASE_KEY_PREFIX}${boardId}`
}

function isMapAnchor(value: unknown): value is MapAnchor {
    if (!value || typeof value !== 'object') return false
    const anchor = value as Partial<MapAnchor>
    return (
        Array.isArray(anchor.lngLat) &&
        anchor.lngLat.length === 2 &&
        anchor.lngLat.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
        typeof anchor.zoom === 'number' &&
        Number.isFinite(anchor.zoom)
    )
}

/**
 * Read a board's persisted base. Returns the default config for anything
 * missing, expired, malformed or hand-edited — never throws, because a bad
 * entry here must not be able to stop a board from opening.
 */
export function readBaseConfig(boardId: string): BaseConfig {
    const fallback: BaseConfig = { base: DEFAULT_BASE, mapAnchor: null }
    if (!boardId) return fallback

    try {
        const raw = localStorage.getItem(keyFor(boardId))
        if (!raw) return fallback

        const parsed = JSON.parse(raw) as Partial<StoredBaseConfig>
        if (
            !parsed.savedAt ||
            Date.now() - parsed.savedAt > VIEWPORT_TTL_MS ||
            !isBaseId(parsed.base)
        ) {
            localStorage.removeItem(keyFor(boardId))
            return fallback
        }

        return {
            base: parsed.base,
            mapAnchor: isMapAnchor(parsed.mapAnchor) ? parsed.mapAnchor : null,
        }
    } catch {
        // Corrupt entry — drop it and open on the default base.
        try {
            localStorage.removeItem(keyFor(boardId))
        } catch {
            // localStorage unavailable (private mode); nothing to clean up.
        }
        return fallback
    }
}

/**
 * Persist a board's base. Call only from an explicit user action — see rule 2
 * above. A quota failure is swallowed: losing the base preference is a far
 * better outcome than blocking the switch the user just asked for.
 */
export function writeBaseConfig(boardId: string, config: BaseConfig): void {
    if (!boardId) return
    try {
        const payload: StoredBaseConfig = {
            base: config.base,
            mapAnchor: config.mapAnchor ?? null,
            savedAt: Date.now(),
        }
        localStorage.setItem(keyFor(boardId), JSON.stringify(payload))
    } catch {
        // Quota / private mode — the switch still applies for this session.
    }
}
