// Owns the active type for a base: which provider is mounted, switching
// between them, and persisting the choice.
//
// Mount timing is the subtle part. The backdrop slot (`#cb-base-root`) lives
// inside newCanvas's render tree, and Board is React.lazy + Suspense — mounting
// from an effect here would race the chunk load and find no container. So the
// mount is driven by the first camera event instead: newCanvas fires
// onCameraChange once immediately after the viewport is restored, which both
// proves the DOM exists and hands us the restored camera, so a map base lands on
// the user's saved view rather than at the origin.

import { useCallback, useEffect, useRef, useState } from 'react'
import { loadBaseTypeProvider } from '../baseTypes/registry'
import { readBaseTypeConfig, writeBaseTypeConfig } from '../baseTypes/baseTypeStorage'
import { boardType } from '../baseTypes/boardType'
import { DEFAULT_BASE_TYPE } from '../baseTypes/types'
import type {
    BaseTypeConfig,
    BaseTypeHandle,
    BaseType,
    BaseTypeProvider,
    MapAnchor,
} from '../baseTypes/types'
import type { ServerBaseConfig } from '../baseTypes/serverConfig'
import type { CameraChangeEvent } from '../types/base'

export const BASE_ROOT_ID = 'cb-base-root'

export interface ActiveBaseTypeOptions {
    baseId: string
    /**
     * Base type to open on when the base has no persisted choice. Callers that
     * are inherently map-backed (craftmaps) pin this; the standalone app leaves
     * it undefined so every existing base keeps opening on the board base.
     */
    defaultBaseType?: BaseType
    /**
     * The base row as fetched from the server, for a persisted base. Null on
     * `/`, where there is no row yet.
     *
     * Must be available on the FIRST render, which is why the caller resolves
     * it from an already-gated query rather than an effect. Everything
     * downstream — the viewport key the camera restores under, the zoom limits
     * it is clamped to, and the anchor the provider mounts on — is decided
     * before this hook's first commit. A late arrival doesn't correct them; it
     * corrupts them.
     */
    serverConfig?: ServerBaseConfig | null
    /**
     * The route *is* the type (`/map/:id`). Outranks everything, hides the
     * switcher, and makes `switchBaseType` inert.
     *
     * Distinct from `defaultBaseType`, which is only a fallback a user switch
     * overrides.
     */
    pinnedBaseType?: BaseType
}

export interface ActiveBaseTypeApi {
    activeBaseType: BaseType
    /**
     * Did this base arrive with a map anchor already persisted?
     *
     * Snapshotted at init and never updated, on purpose: it answers "has this
     * base ever settled on a place", which is what the first-visit location
     * prompt gates on. Reading the LIVE config would answer "is an anchor set
     * right now", which is always true once the map mounts (the provider fills
     * in a timezone guess), so the prompt would never appear.
     *
     * Counts a SERVER anchor too, because `initialConfig` now merges one. That
     * is what keeps "where are you mapping?" shut for someone opening a shared
     * map: the base has very much settled on a place — just not by them.
     */
    hadStoredMapAnchor: boolean
    /** The mounted provider. Falls back to the board base until one resolves. */
    provider: BaseTypeProvider
    switchBaseType: (id: BaseType) => void
    /** Feed every ZUI camera update here. Also triggers the deferred mount. */
    handleCameraChange: (camera: CameraChangeEvent) => void
    /** Rasterize the live backdrop for PNG export; null when there's nothing. */
    captureBackdrop: (width: number, height: number) => Promise<string | null>
    /** Current persisted-shape config, for the JSON export envelope. */
    readConfig: () => BaseTypeConfig
    /** Recentre the backdrop on a place and persist it (map base only). */
    setMapAnchor: (anchor: MapAnchor) => void
}

export function useActiveBaseType({
    baseId,
    defaultBaseType,
    serverConfig,
    pinnedBaseType,
}: ActiveBaseTypeOptions): ActiveBaseTypeApi {
    // Read-only at init: opening a base must never write a type key. Resolved
    // exactly once — Board re-renders on every component-store change, and a
    // localStorage read + JSON.parse per render is real work on a large base.
    //
    // The server row is merged in HERE, in the initializer, rather than through
    // an effect. Three things read this config before any effect could fire:
    // `configRef` (handed to the provider at mount, and never re-anchored
    // afterwards), the viewport key the camera restores under, and the zoom
    // limits it is clamped to. Injecting the anchor later mounts the map on the
    // wrong geography, permanently.
    const [initialConfig] = useState<BaseTypeConfig>(() => {
        const local = readBaseTypeConfig(baseId)
        return {
            type:
                pinnedBaseType ??
                serverConfig?.type ??
                local.type ??
                defaultBaseType ??
                DEFAULT_BASE_TYPE,
            // The server anchor outranks the local one. It is the georeference
            // every persisted element's x/y was measured against, so a
            // divergent local key is not a preference — it is corruption, and
            // honouring it would scatter the ink across the wrong continent.
            mapAnchor: serverConfig?.mapAnchor ?? local.mapAnchor ?? null,
        }
    })
    const [activeBaseType, setActiveBaseType] = useState<BaseType>(
        () => initialConfig.type
    )
    const [provider, setProvider] = useState<BaseTypeProvider>(boardType)

    const handleRef = useRef<BaseTypeHandle | null>(null)
    const providerRef = useRef<BaseTypeProvider>(boardType)
    const lastCameraRef = useRef<CameraChangeEvent | null>(null)
    // Guards against a slow dynamic import resolving after the user has already
    // switched away — the stale provider must not mount over the current one.
    const mountTokenRef = useRef(0)

    const configRef = useRef<BaseTypeConfig>(initialConfig)

    // Providers report async state back through this. Merged into the live
    // config and persisted, so the next load reuses it.
    const saveConfig = useCallback(
        (patch: Partial<BaseTypeConfig>): void => {
            const merged = { ...configRef.current, ...patch }
            configRef.current = merged
            writeBaseTypeConfig(baseId, merged)
        },
        [baseId]
    )

    const mountBaseType = useCallback(
        async (id: BaseType): Promise<void> => {
            const token = ++mountTokenRef.current
            const container = document.getElementById(BASE_ROOT_ID)
            if (!container) return

            const next = await loadBaseTypeProvider(id)
            if (token !== mountTokenRef.current) return

            const previous = handleRef.current
            if (previous) providerRef.current.unmount(previous)

            const handle = await next.mount(container, configRef.current, {
                saveConfig,
            })
            if (token !== mountTokenRef.current) {
                next.unmount(handle)
                return
            }

            handleRef.current = handle
            providerRef.current = next
            setProvider(next)

            // Land on the current camera immediately, so switching doesn't show a
            // backdrop at the origin for a frame before the next pan.
            const camera = lastCameraRef.current
            if (camera) next.syncCamera(handle, camera)
        },
        [saveConfig]
    )

    const handleCameraChange = useCallback(
        (camera: CameraChangeEvent): void => {
            lastCameraRef.current = camera
            const handle = handleRef.current
            if (handle) {
                providerRef.current.syncCamera(handle, camera)
                return
            }
            // First camera event — the canvas DOM now exists, so mount.
            void mountBaseType(activeBaseType)
        },
        [activeBaseType, mountBaseType]
    )

    const switchBaseType = useCallback(
        (id: BaseType): void => {
            // On a pinned route the type is the URL. Refusing here (rather than
            // only hiding the switcher) means no stray caller can write a
            // localStorage type that disagrees with the address bar.
            if (pinnedBaseType) return
            if (id === activeBaseType) return
            setActiveBaseType(id)
            const config: BaseTypeConfig = { ...configRef.current, type: id }
            configRef.current = config
            // An explicit switch is the only thing that writes a base key.
            writeBaseTypeConfig(baseId, config)
            void mountBaseType(id)
        },
        [activeBaseType, baseId, mountBaseType, pinnedBaseType]
    )

    // Tear down on unmount so a provider's renderer (and its GPU context) is
    // released rather than leaking across base navigations.
    useEffect(() => {
        return (): void => {
            mountTokenRef.current++
            const handle = handleRef.current
            if (handle) providerRef.current.unmount(handle)
            handleRef.current = null
        }
    }, [])

    const captureBackdrop = useCallback(
        async (width: number, height: number): Promise<string | null> => {
            const handle = handleRef.current
            if (!handle) return null
            return providerRef.current.captureBackdrop(handle, width, height)
        },
        []
    )

    /**
     * Recentre the active backdrop (map base: jump to a searched place) and
     * persist it. No-op on a base with nothing to recentre.
     */
    const setMapAnchor = useCallback(
        (anchor: MapAnchor): void => {
            const handle = handleRef.current
            const provider = providerRef.current
            if (!handle || !provider.setAnchor) return
            provider.setAnchor(handle, anchor)
            saveConfig({ mapAnchor: anchor })
        },
        [saveConfig]
    )

    const readConfig = useCallback((): BaseTypeConfig => {
        const handle = handleRef.current
        const extra =
            handle && providerRef.current.readConfig
                ? providerRef.current.readConfig(handle)
                : null
        return { ...configRef.current, ...(extra ?? {}), type: activeBaseType }
    }, [activeBaseType])

    return {
        activeBaseType,
        hadStoredMapAnchor: Boolean(initialConfig.mapAnchor),
        provider,
        switchBaseType,
        handleCameraChange,
        captureBackdrop,
        readConfig,
        setMapAnchor,
    }
}
