import { useState, useEffect, useRef } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import {
    DRAFT_STORAGE_KEY,
    DRAFT_EXPIRY_MS,
    BACKGROUND_BOARD_STORAGE_KEY,
    STORAGE_QUOTA_ERROR_NAME,
    GROUP_COMPONENT,
    WELCOME_DISMISSED_KEY,
} from '../constants/misc'
import type { ComponentStore } from '../types/board'
import {
    buildWelcomeSketch,
    isWelcomeComponent,
} from '../utils/welcomeSketch'
import {
    isRawDraftOverBudget,
    readRawDraft,
    downloadRawDraftBackup,
    measureStoredDraftUtf8Bytes,
    MAX_DRAFT_UTF8_BYTES,
} from '../utils/boardSizeGuard'

export interface LocalDraftPersistenceOptions {
    isPersisted: boolean
    localBoardId: string
    componentStore: ComponentStore
    setComponentStore: Dispatch<SetStateAction<ComponentStore>>
    backgroundBoardIdRef: MutableRefObject<string | null>
    setBackgroundBoardId: Dispatch<SetStateAction<string | null>>
    onStorageLimitRef?: MutableRefObject<(() => void) | null>
    /**
     * Fired right after a draft write whose UTF-8 size exceeds
     * `MAX_DRAFT_UTF8_BYTES` — the write-side guard. The host reverts the last
     * action and surfaces the "board is full" modal.
     */
    onDraftOverBudgetRef?: MutableRefObject<(() => void) | null>
    /** Opt-in onboarding seed; see BoardProps.welcomeSketch. */
    welcomeSketch?: boolean
    /**
     * Forwarded to `buildWelcomeSketch` to pick the mobile vs. large-screen
     * layout. The mobile layout points "Pick a shape" at the bottom-left
     * toolbar instead of the top-center one and drops the zoom arrow.
     */
    isMobile?: boolean
}

export interface LocalDraftPersistenceApi {
    showStorageLimitModal: boolean
    setShowStorageLimitModal: Dispatch<SetStateAction<boolean>>
    storageLimitBoardUrl: string | null
    setStorageLimitBoardUrl: Dispatch<SetStateAction<string | null>>
    handleStartNewCanvas: () => void
    handleContinueOnSavedBoard: () => void
    // Load-side rescue for a persisted draft too large to render safely.
    showBoardTooLargeModal: boolean
    handleDownloadBoardBackup: () => void
    handleStartFreshFromTooLarge: () => void
    handleOpenBoardAnyway: () => void
    /** Live UTF-8 byte size of the persisted draft, refreshed on every save. */
    draftSizeBytes: number
}

interface PersistedDraft {
    boardId?: string
    components?: ComponentStore
    timestamp?: number
}

export function useLocalDraftPersistence({
    isPersisted,
    localBoardId,
    componentStore,
    setComponentStore,
    backgroundBoardIdRef,
    setBackgroundBoardId,
    onStorageLimitRef,
    onDraftOverBudgetRef,
    welcomeSketch,
    isMobile,
}: LocalDraftPersistenceOptions): LocalDraftPersistenceApi {
    const [showStorageLimitModal, setShowStorageLimitModal] = useState(false)
    const [draftSizeBytes, setDraftSizeBytes] = useState(0)
    const [storageLimitBoardUrl, setStorageLimitBoardUrl] = useState<
        string | null
    >(null)
    const [showBoardTooLargeModal, setShowBoardTooLargeModal] = useState(false)
    // Raw (unparsed) draft text deliberately NOT loaded because it's over
    // budget. Kept as a string — parsing it is itself heavy enough to stutter
    // the page — so it's only parsed if the user explicitly hits "Open anyway".
    const deferredRawDraftRef = useRef<string | null>(null)
    const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Restore draft and background board ID from localStorage on mount (local mode only)
    useEffect(() => {
        if (isPersisted) return

        const savedBgBoardId = localStorage.getItem(BACKGROUND_BOARD_STORAGE_KEY)
        if (savedBgBoardId) {
            backgroundBoardIdRef.current = savedBgBoardId
            setBackgroundBoardId(savedBgBoardId)
        }

        let restoredDraft = false
        try {
            const draft = localStorage.getItem(DRAFT_STORAGE_KEY)
            if (draft) {
                // Load-side guard FIRST, on the raw string — before any parse.
                // Parsing + rebuilding a multi-MB object graph is itself heavy
                // enough to stutter the page, so an over-budget draft must
                // never be parsed on load. Stash the raw text and surface the
                // rescue modal instead; only "Open anyway" parses it.
                // `restoredDraft` stays true so we don't seed the welcome
                // sketch over it.
                if (isRawDraftOverBudget(draft)) {
                    deferredRawDraftRef.current = draft
                    setShowBoardTooLargeModal(true)
                    restoredDraft = true
                } else {
                    const parsed = JSON.parse(draft) as PersistedDraft
                    const age = Date.now() - (parsed.timestamp ?? 0)
                    if (age < DRAFT_EXPIRY_MS && parsed.components) {
                        const safeComponents = Object.fromEntries(
                            Object.entries(parsed.components).filter(
                                ([, v]) =>
                                    v?.componentType !== GROUP_COMPONENT
                            )
                        ) as ComponentStore
                        if (Object.keys(safeComponents).length > 0) {
                            setComponentStore(safeComponents)
                            restoredDraft = true
                        }
                    } else {
                        localStorage.removeItem(DRAFT_STORAGE_KEY)
                        localStorage.removeItem(BACKGROUND_BOARD_STORAGE_KEY)
                    }
                }
            }
        } catch {
            localStorage.removeItem(DRAFT_STORAGE_KEY)
            localStorage.removeItem(BACKGROUND_BOARD_STORAGE_KEY)
        }

        // First-visit welcome seed: only when opt-in flag is set, no draft was
        // restored, and the user has not previously dismissed the sketch on
        // this browser profile.
        if (
            welcomeSketch &&
            !restoredDraft &&
            !localStorage.getItem(WELCOME_DISMISSED_KEY)
        ) {
            setComponentStore(
                buildWelcomeSketch(localBoardId, {
                    width: window.innerWidth,
                    height: window.innerHeight,
                    isMobile,
                })
            )
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Save draft to localStorage on changes (debounced, local mode only)
    useEffect(() => {
        if (isPersisted) return
        if (Object.keys(componentStore).length === 0) return

        const writeDraft = (): void => {
            try {
                // Skip groupobject (transient) AND welcome-sketch seeds — the
                // sketch is onboarding scaffolding that must never persist
                // into the user's draft.
                const componentsToSave = Object.fromEntries(
                    Object.entries(componentStore).filter(
                        ([, v]) =>
                            v?.componentType !== GROUP_COMPONENT &&
                            !isWelcomeComponent(v)
                    )
                ) as ComponentStore
                if (Object.keys(componentsToSave).length === 0) return
                localStorage.setItem(
                    DRAFT_STORAGE_KEY,
                    JSON.stringify({
                        boardId: localBoardId,
                        components: componentsToSave,
                        timestamp: Date.now(),
                    })
                )

                // Write-side guard: measure the REAL UTF-8 size of what we just
                // persisted (TextEncoder on the draft key), keep the live
                // readout current, and revert the last action if it's over the
                // budget.
                const bytes = measureStoredDraftUtf8Bytes()
                setDraftSizeBytes(bytes)
                if (bytes > MAX_DRAFT_UTF8_BYTES) {
                    onDraftOverBudgetRef?.current?.()
                }
            } catch (e) {
                if (
                    e instanceof DOMException &&
                    e.name === STORAGE_QUOTA_ERROR_NAME
                ) {
                    onStorageLimitRef?.current?.()
                }
            }
        }

        if (draftSaveTimerRef.current) {
            clearTimeout(draftSaveTimerRef.current)
        }
        draftSaveTimerRef.current = setTimeout(writeDraft, 500)

        // Flush the pending save synchronously if the page is being hidden
        // (reload / navigation). Without this, a reload fired inside the 500ms
        // debounce window drops the latest change — most visibly a theme-toggle
        // recolor — so the next load restores the stale pre-change colors (e.g.
        // dark shapes after switching to light then quickly reloading).
        const flushDraftSave = (): void => {
            if (draftSaveTimerRef.current) {
                clearTimeout(draftSaveTimerRef.current)
                draftSaveTimerRef.current = null
            }
            writeDraft()
        }
        window.addEventListener('pagehide', flushDraftSave)

        return (): void => {
            if (draftSaveTimerRef.current) {
                clearTimeout(draftSaveTimerRef.current)
            }
            window.removeEventListener('pagehide', flushDraftSave)
        }
    }, [componentStore, isPersisted])

    const handleStartNewCanvas = (): void => {
        localStorage.removeItem(DRAFT_STORAGE_KEY)
        setShowStorageLimitModal(false)
        setStorageLimitBoardUrl(null)
        window.location.href = '/'
    }

    const handleContinueOnSavedBoard = (): void => {
        setShowStorageLimitModal(false)
        if (storageLimitBoardUrl) {
            window.location.href = storageLimitBoardUrl
        }
    }

    // Rescue: download the raw over-budget draft straight from localStorage
    // (no rendering, so it can't freeze) so the user keeps their work.
    const handleDownloadBoardBackup = (): void => {
        const raw = readRawDraft()
        if (raw) downloadRawDraftBackup(raw)
    }

    const handleStartFreshFromTooLarge = (): void => {
        localStorage.removeItem(DRAFT_STORAGE_KEY)
        deferredRawDraftRef.current = null
        setShowBoardTooLargeModal(false)
        window.location.href = '/'
    }

    // Explicit override: parse the deferred (over-budget) draft now and render
    // it anyway — this is the heavy work the load path deliberately skipped, so
    // it may freeze; the user opted in. The write-side guard leaves the result
    // alone because the undo stack is empty.
    const handleOpenBoardAnyway = (): void => {
        const raw = deferredRawDraftRef.current
        if (raw) {
            try {
                const parsed = JSON.parse(raw) as PersistedDraft
                if (parsed.components) {
                    const safeComponents = Object.fromEntries(
                        Object.entries(parsed.components).filter(
                            ([, v]) => v?.componentType !== GROUP_COMPONENT
                        )
                    ) as ComponentStore
                    if (Object.keys(safeComponents).length > 0) {
                        setComponentStore(safeComponents)
                    }
                }
            } catch {
                // Corrupt draft — nothing to open; fall through to close.
            }
            deferredRawDraftRef.current = null
        }
        setShowBoardTooLargeModal(false)
    }

    return {
        showStorageLimitModal,
        setShowStorageLimitModal,
        storageLimitBoardUrl,
        setStorageLimitBoardUrl,
        handleStartNewCanvas,
        handleContinueOnSavedBoard,
        showBoardTooLargeModal,
        handleDownloadBoardBackup,
        handleStartFreshFromTooLarge,
        handleOpenBoardAnyway,
        draftSizeBytes,
    }
}
