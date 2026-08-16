// Base registry — maps a BaseId to a lazily-imported provider.
//
// The board base is imported eagerly: it's a few lines, it's the default, and
// making it async would put a promise between mount and first paint for every
// user. Heavier bases (the map base pulls in maplibre-gl, ~800KB) go through a
// dynamic import so nobody who stays on the board base ever downloads them.

import { boardBase } from './boardBase'
import type { BaseId, BaseProvider } from './types'

type ProviderLoader = () => Promise<BaseProvider>

const LOADERS: Record<BaseId, ProviderLoader> = {
    board: async () => boardBase,
    // Dynamic: pulls in maplibre-gl (~800KB) plus its stylesheet, and only for
    // users who actually open the map base.
    map: async () => (await import('./mapBase')).mapBase,
}

const cache = new Map<BaseId, BaseProvider>()

/** Resolve a provider, memoising so repeated switches don't re-import. */
export async function loadBaseProvider(id: BaseId): Promise<BaseProvider> {
    const cached = cache.get(id)
    if (cached) return cached

    const loader = LOADERS[id]
    const provider = await loader()
    cache.set(id, provider)
    return provider
}

/** Synchronous access for a provider already resolved. */
export function getLoadedBaseProvider(id: BaseId): BaseProvider | null {
    return cache.get(id) ?? null
}

export function isBaseId(value: unknown): value is BaseId {
    return value === 'board' || value === 'map'
}
