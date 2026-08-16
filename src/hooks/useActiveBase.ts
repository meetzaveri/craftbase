// Owns the active base for a board: which provider is mounted, switching
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
import { loadBaseProvider } from '../bases/registry'
import { readBaseConfig, writeBaseConfig } from '../bases/baseStorage'
import { boardBase } from '../bases/boardBase'
import { DEFAULT_BASE } from '../bases/types'
import type {
    BaseConfig,
    BaseHandle,
    BaseId,
    BaseProvider,
    MapAnchor,
} from '../bases/types'
import type { CameraChangeEvent } from '../types/board'

export const BASE_ROOT_ID = 'cb-base-root'

export interface ActiveBaseOptions {
    boardId: string
    /**
     * Base to open on when the board has no persisted choice. Consumers that
     * are inherently map-backed (craftmaps) pin this; the standalone app leaves
     * it undefined so every existing board keeps opening on the board base.
     */
    defaultBase?: BaseId
}

export interface ActiveBaseApi {
    activeBase: BaseId
    /** The mounted provider. Falls back to the board base until one resolves. */
    provider: BaseProvider
    switchBase: (id: BaseId) => void
    /** Feed every ZUI camera update here. Also triggers the deferred mount. */
    handleCameraChange: (camera: CameraChangeEvent) => void
    /** Rasterize the live backdrop for PNG export; null when there's nothing. */
    captureBackdrop: (width: number, height: number) => Promise<string | null>
    /** Current persisted-shape config, for the JSON export envelope. */
    readConfig: () => BaseConfig
    /** Recentre the backdrop on a place and persist it (map base only). */
    setMapAnchor: (anchor: MapAnchor) => void
}

export function useActiveBase({
    boardId,
    defaultBase,
}: ActiveBaseOptions): ActiveBaseApi {
    // Read-only at init: opening a board must never write a base key. Resolved
    // exactly once — Board re-renders on every component-store change, and a
    // localStorage read + JSON.parse per render is real work on a large board.
    const [initialConfig] = useState<BaseConfig>(() => readBaseConfig(boardId))
    const [activeBase, setActiveBase] = useState<BaseId>(
        () => initialConfig.base ?? defaultBase ?? DEFAULT_BASE
    )
    const [provider, setProvider] = useState<BaseProvider>(boardBase)

    const handleRef = useRef<BaseHandle | null>(null)
    const providerRef = useRef<BaseProvider>(boardBase)
    const lastCameraRef = useRef<CameraChangeEvent | null>(null)
    // Guards against a slow dynamic import resolving after the user has already
    // switched away — the stale provider must not mount over the current one.
    const mountTokenRef = useRef(0)

    const configRef = useRef<BaseConfig>(initialConfig)

    // Providers report async state back through this (the map base resolves its
    // anchor from geolocation long after mount). Merged into the live config and
    // persisted, so the next load reuses it instead of re-geolocating.
    const saveConfig = useCallback(
        (patch: Partial<BaseConfig>): void => {
            const merged = { ...configRef.current, ...patch }
            configRef.current = merged
            writeBaseConfig(boardId, merged)
        },
        [boardId]
    )

    const mountBase = useCallback(
        async (id: BaseId): Promise<void> => {
        const token = ++mountTokenRef.current
        const container = document.getElementById(BASE_ROOT_ID)
        if (!container) return

        const next = await loadBaseProvider(id)
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
            void mountBase(activeBase)
        },
        [activeBase, mountBase]
    )

    const switchBase = useCallback(
        (id: BaseId): void => {
            if (id === activeBase) return
            setActiveBase(id)
            const config: BaseConfig = { ...configRef.current, base: id }
            configRef.current = config
            // An explicit switch is the only thing that writes a base key.
            writeBaseConfig(boardId, config)
            void mountBase(id)
        },
        [activeBase, boardId, mountBase]
    )

    // Tear down on unmount so a provider's renderer (and its GPU context) is
    // released rather than leaking across board navigations.
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

    const readConfig = useCallback((): BaseConfig => {
        const handle = handleRef.current
        const extra =
            handle && providerRef.current.readConfig
                ? providerRef.current.readConfig(handle)
                : null
        return { ...configRef.current, ...(extra ?? {}), base: activeBase }
    }, [activeBase])

    return {
        activeBase,
        provider,
        switchBase,
        handleCameraChange,
        captureBackdrop,
        readConfig,
        setMapAnchor,
    }
}
