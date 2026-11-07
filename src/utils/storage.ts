// Storage adapter: the single path every craftbase read/write of browser
// storage goes through.
//
// - 'local'  → window.localStorage. The standalone app runs here with no key
//              namespace, so existing user drafts/viewports keep loading.
// - 'memory' → a module-level Map. Used by the embedded <Craftbase> before the
//              user grants storage consent (or after they refuse). Nothing
//              touches localStorage, so a refresh loses the board — by design.
//
// Every key craftbase uses starts with `craftbase_` (see constants/misc.ts),
// so they never get mixed up with a host app's own keys. An embed with a
// `storageKey` also namespaces them with a suffix: with storageKey "demo",
// `craftbase_local_draft` is stored as `craftbase_local_draft__demo`. (A
// suffix, not `craftbase_demo_...`, so a namespace can never turn a key into
// something matching another key family's prefix, e.g. craftbase_viewport_.)
//
// setItem in 'local' mode deliberately re-throws (QuotaExceededError) — the
// draft writer relies on that to open the storage-limit flow.

export type StorageMode = 'local' | 'memory'

interface StorageConfig {
    mode: StorageMode
    /** Embed `storageKey`; '' = no namespace (the app, or an embed without one). */
    namespace: string
}

const KEY_PREFIX = 'craftbase_'

let config: StorageConfig = { mode: 'local', namespace: '' }
const memory = new Map<string, string>()

export function configureStorage(next: Partial<StorageConfig>): void {
    config = { ...config, ...next }
}

export function getStorageMode(): StorageMode {
    return config.mode
}

const NAMESPACE_SEPARATOR = '__'

/** Logical key → the key actually stored in localStorage. */
function toStoredKey(key: string): string {
    if (!config.namespace) return key
    return `${key}${NAMESPACE_SEPARATOR}${config.namespace}`
}

/** Stored key → logical key, or null when it isn't in this namespace. */
function fromStoredKey(stored: string): string | null {
    if (!stored.startsWith(KEY_PREFIX)) return null
    if (!config.namespace) {
        return stored.includes(NAMESPACE_SEPARATOR) ? null : stored
    }
    const suffix = `${NAMESPACE_SEPARATOR}${config.namespace}`
    return stored.endsWith(suffix) ? stored.slice(0, -suffix.length) : null
}

function local(): Storage | null {
    try {
        return typeof window !== 'undefined' ? window.localStorage : null
    } catch {
        // Access can throw (sandboxed iframe, privacy mode).
        return null
    }
}

export const cbStorage = {
    getItem(key: string): string | null {
        if (config.mode === 'memory') return memory.get(key) ?? null
        try {
            return local()?.getItem(toStoredKey(key)) ?? null
        } catch {
            return null
        }
    },

    setItem(key: string, value: string): void {
        if (config.mode === 'memory') {
            memory.set(key, value)
            return
        }
        local()?.setItem(toStoredKey(key), value)
    },

    removeItem(key: string): void {
        if (config.mode === 'memory') {
            memory.delete(key)
            return
        }
        try {
            local()?.removeItem(toStoredKey(key))
        } catch {
            /* ignore */
        }
    },

    /** Logical (un-namespaced) craftbase keys in the active backend. */
    keys(): string[] {
        if (config.mode === 'memory') return Array.from(memory.keys())
        const ls = local()
        if (!ls) return []
        const out: string[] = []
        for (let i = 0; i < ls.length; i++) {
            const k = ls.key(i)
            const logical = k == null ? null : fromStoredKey(k)
            if (logical) out.push(logical)
        }
        return out
    },
}

/**
 * Switch from memory to localStorage, carrying over everything written so far
 * (draw-mode flags, element defaults, the draft) so the session continues
 * seamlessly after the user grants consent.
 */
export function promoteMemoryToLocal(): void {
    if (config.mode === 'local') return
    const ls = local()
    config = { ...config, mode: 'local' }
    if (!ls) return
    memory.forEach((value, key) => {
        try {
            ls.setItem(toStoredKey(key), value)
        } catch {
            /* quota — the draft writer will surface it on its next save */
        }
    })
    memory.clear()
}

/** Test-only / remount helper. */
export function resetMemoryStorage(): void {
    memory.clear()
}
