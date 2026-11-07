import { configureStorage, promoteMemoryToLocal } from '../utils/storage'
import { STORAGE_CONSENT_KEY } from '../constants/misc'

/**
 * 'ask'    — show the consent banner until the user answers (default).
 * 'local'  — host already has consent: save to localStorage, no banner.
 * 'memory' — never touch localStorage; a refresh loses the board.
 */
export type StorageOption = 'ask' | 'local' | 'memory'

export type ConsentAnswer = 'granted' | 'denied'

// Only the user's answer lives here — never board data. Written straight to
// localStorage (not through cbStorage) because it has to survive 'memory'
// mode: remembering a "No" is what stops us re-asking on every load.
const CONSENT_KEY = STORAGE_CONSENT_KEY

export function readConsent(): ConsentAnswer | null {
    try {
        const v = window.localStorage.getItem(CONSENT_KEY)
        return v === 'granted' || v === 'denied' ? v : null
    } catch {
        return null
    }
}

export function writeConsent(answer: ConsentAnswer): void {
    try {
        window.localStorage.setItem(CONSENT_KEY, answer)
    } catch {
        /* storage unavailable — the answer just won't be remembered */
    }
}

/** `storageKey` → key namespace: lowercase, `[a-z0-9-]` only. */
export function storageNamespace(storageKey?: string): string {
    return (storageKey ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

/**
 * Point the storage adapter at the right backend for this embed, BEFORE Board
 * mounts (Board reads the draft in its first render). Returns whether the
 * consent banner should show.
 */
export function initEmbedStorage(
    option: StorageOption,
    storageKey?: string
): { needsConsent: boolean } {
    const namespace = storageNamespace(storageKey)
    if (option === 'local') {
        configureStorage({ mode: 'local', namespace })
        return { needsConsent: false }
    }
    if (option === 'memory') {
        configureStorage({ mode: 'memory', namespace })
        return { needsConsent: false }
    }
    const answer = readConsent()
    configureStorage({
        mode: answer === 'granted' ? 'local' : 'memory',
        namespace,
    })
    return { needsConsent: answer === null }
}

/** User said yes: remember it and move the in-memory session to localStorage. */
export function grantStorageConsent(): void {
    writeConsent('granted')
    promoteMemoryToLocal()
}

export function denyStorageConsent(): void {
    writeConsent('denied')
}
