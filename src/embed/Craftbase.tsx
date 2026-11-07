import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from 'react'
import type { CSSProperties, ForwardedRef, ReactElement } from 'react'
import { ApolloProvider } from '@apollo/client'

import BoardViewContainer from '../views/Board'
import type { BoardApi, CraftbaseData } from '../types/component'
import { EMBED_FEATURES } from './embedConfig'
import { createOfflineApolloClient } from './offlineApolloClient'
import { ensureFontsLoaded } from './fonts'
import {
    initEmbedStorage,
    grantStorageConsent,
    denyStorageConsent,
} from './storageConsent'
import type { StorageOption } from './storageConsent'
import StorageConsentBanner from './StorageConsentBanner'
import { setEmbedRoot, installEmbedEventScope } from '../utils/embedRoot'

export interface CraftbaseProps {
    /** Document to start from. Read once at mount (remount with `key` to reset). */
    initialData?: CraftbaseData
    /** Fires with the full document on every change. */
    onChange?: (data: CraftbaseData) => void
    /** Where the board is kept between page loads. Default 'ask'. */
    storage?: StorageOption
    /** Namespaces stored keys, so several boards can live on one origin. */
    storageKey?: string
    /** Color theme. Default 'light'. */
    theme?: 'light' | 'dark'
    /** Inject the Google Fonts stylesheet craftbase uses. Default true. */
    loadFonts?: boolean
    className?: string
    style?: CSSProperties
}

export type CraftbaseHandle = BoardApi

const NOOP_API: BoardApi = {
    load: () => {},
    clear: () => {},
    getData: () => ({ formatVersion: '1.1', components: {} }),
}

function CraftbaseInner(
    {
        initialData,
        onChange,
        storage = 'ask',
        storageKey,
        theme = 'light',
        loadFonts = true,
        className,
        style,
    }: CraftbaseProps,
    ref: ForwardedRef<CraftbaseHandle>
): ReactElement {
    // Storage must be configured before Board's first render reads the draft,
    // so this runs in a state initializer (synchronously, during render).
    const [needsConsent, setNeedsConsent] = useState(
        () => initEmbedStorage(storage, storageKey).needsConsent
    )
    const [client] = useState(createOfflineApolloClient)
    // Read once, like initialData, so a parent re-render can't reset the board.
    const [initialDataAtMount] = useState(initialData)

    const apiRef = useRef<BoardApi | null>(null)
    const rootRef = useRef<HTMLElement | null>(null)

    useImperativeHandle(
        ref,
        () => ({
            load: (data) => (apiRef.current ?? NOOP_API).load(data),
            clear: () => (apiRef.current ?? NOOP_API).clear(),
            getData: () => (apiRef.current ?? NOOP_API).getData(),
        }),
        []
    )

    useEffect(() => {
        if (loadFonts) ensureFontsLoaded()
    }, [loadFonts])

    const disposeEventScopeRef = useRef<(() => void) | null>(null)
    const setRoot = useCallback((el: HTMLDivElement | null) => {
        rootRef.current = el
        setEmbedRoot(el)
        disposeEventScopeRef.current?.()
        disposeEventScopeRef.current = el ? installEmbedEventScope(el) : null
    }, [])

    const handleAllow = useCallback(() => {
        grantStorageConsent()
        setNeedsConsent(false)
    }, [])

    const handleDecline = useCallback(() => {
        denyStorageConsent()
        setNeedsConsent(false)
    }, [])

    return (
        <div
            ref={setRoot}
            className={`cb-embed ${theme === 'dark' ? 'dark' : ''} ${
                className ?? ''
            }`}
            style={style}
            data-craftbase-root=""
        >
            <ApolloProvider client={client}>
                <BoardViewContainer
                    features={EMBED_FEATURES}
                    initialData={initialDataAtMount}
                    onChange={onChange}
                    apiRef={apiRef}
                    rootRef={rootRef}
                />
            </ApolloProvider>
            {needsConsent && (
                <StorageConsentBanner
                    onAllow={handleAllow}
                    onDecline={handleDecline}
                />
            )}
        </div>
    )
}

/**
 * Embeddable craftbase whiteboard. Render it inside a sized element; it fills
 * that element. One instance per page.
 */
export const Craftbase = forwardRef(CraftbaseInner)
Craftbase.displayName = 'Craftbase'
