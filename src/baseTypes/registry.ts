// Base-type registry — maps a BaseType to a lazily-imported provider.
//
// The board base is imported eagerly: it's a few lines, it's the default, and
// making it async would put a promise between mount and first paint for every
// user. Heavier types (the map pulls in maplibre-gl, ~800KB) go through a
// dynamic import so nobody who stays on the whiteboard ever downloads them.

import { boardType } from './boardType'
import type { BaseType, BaseTypeProvider } from './types'

type ProviderLoader = () => Promise<BaseTypeProvider>

const LOADERS: Record<BaseType, ProviderLoader> = {
    board: async () => boardType,
    // Dynamic: pulls in maplibre-gl (~800KB) plus its stylesheet, and only for
    // users who actually open the map base.
    map: async () => (await import('./mapType')).mapType,
}

const cache = new Map<BaseType, BaseTypeProvider>()

/** Resolve a provider, memoising so repeated switches don't re-import. */
export async function loadBaseTypeProvider(id: BaseType): Promise<BaseTypeProvider> {
    const cached = cache.get(id)
    if (cached) return cached

    const loader = LOADERS[id]
    const provider = await loader()
    cache.set(id, provider)
    return provider
}

/** Synchronous access for a provider already resolved. */
export function getLoadedBaseTypeProvider(id: BaseType): BaseTypeProvider | null {
    return cache.get(id) ?? null
}

export function isBaseType(value: unknown): value is BaseType {
    return value === 'board' || value === 'map'
}
