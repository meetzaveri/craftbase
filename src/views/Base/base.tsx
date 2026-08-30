import React, {
    useState,
    useEffect,
    useMemo,
    useRef,
    useCallback,
    type ReactNode,
} from 'react'
import { useMutation, useQuery } from '@apollo/client'
import { useParams, useNavigate } from 'react-router-dom'
import { useMediaQueryUtils } from '../../constants/exportHooks'
import {
    GET_COMPONENTS_FOR_BASE_QUERY,
    GET_COMPONENT_TYPES,
} from '../../schema/queries'
import {
    UPDATE_USER_REVISIT_COUNT,
    INSERT_USER_ONE,
    INSERT_COMPONENT,
    INSERT_BULK_COMPONENTS,
    DELETE_COMPONENT_BY_ID,
    DELETE_BULK_COMPONENTS,
    UPDATE_COMPONENT_INFO,
    CREATE_BASE,
    UPDATE_BASE_VISIBILITY,
    SHARE_PERSISTED_BASE,
} from '../../schema/mutations'
import Canvas from '../../newCanvas'
import ZoomControls from '../../components/ZoomControls'
import GoToContentButton from '../../components/goToContentButton'
import HelpButton from '../../components/helpButton'
import Sidebar from '../../components/sidebar/primary'
import ElementPropertiesToolbar from '../../components/sidebar/elementProperties'
import ClusterLayer from '../../components/elements/clusterLayer'
import controlsIcon from '../../assets/controls.svg'
import OkIcon from '../../assets/ok.svg?react'
import CloseIcon from '../../assets/close.svg?react'
import PermissionErrorModal from '../../components/modals/PermissionErrorModal'
import StorageLimitModal from '../../components/modals/StorageLimitModal'
import MapStartLocationModal from '../../components/modals/MapStartLocationModal'
import MobileDeleteButton from '../../components/sidebar/mobileDeleteButton'
import MobileTextControls from '../../components/sidebar/mobileTextControls'
import {
    resolveTimezoneCity,
    DEFAULT_ANCHOR_ZOOM,
} from '../../utils/timezoneCities'
import { zoomLimitsForBaseType } from '../../baseTypes/zoomLimits'
import {
    BaseFullModal,
    BaseTooLargeModal,
} from '../../components/modals/BaseSizeLimitModal'
import { exportBaseAsJson } from '../../utils/exportBase'
import {
    applyBaseTypeVisibility,
    isRecordVisibleOnBaseType,
} from '../../utils/geoVisibility'
import {
    lngLatToSurface,
    mapZoomForScale,
    scaleForMapZoom,
    surfaceToLngLat,
} from '../../baseTypes/mercator'
import { writeBaseTypeConfig } from '../../baseTypes/baseTypeStorage'
import { baseTypeUrl } from '../../utils/baseRoutes'
import {
    readViewport,
    writeViewport,
    IDENTITY_VIEWPORT,
} from '../../utils/viewportStorage'
import type { BaseType, MapAnchor } from '../../baseTypes/types'
import ImportBaseModal from '../../components/modals/ImportBaseModal'
import { openBaseFilePicker, parseImportedBase } from '../../utils/importBase'
import type { ParsedImport, BaseViewport } from '../../utils/importBase'
import { draftFitsForStore } from '../../utils/baseSizeGuard'
import { generateUUID, generateRandomUsernames } from '../../utils/misc'
import { prefetchElementModule } from '../../elementModules'
import {
    pollUntilElement,
    getShapeTextNodes,
    applyShapeText,
    shapeTextStyleFromMeta,
    readOpacity,
} from '../../utils/canvasUtils'
import { resolveHeightForTextStyleChange } from '../../utils/shapeTextFit'
import { themeDefaultInk } from '../../utils/themeColorFlip'
import { lineHeightFor } from '../../utils/textLayout'
import {
    TEXT_SIZES_OBJECT,
    MOBILE_TEXT_SIZES_OBJECT,
    TRANSPARENT_FILL,
    geoElementData,
} from '../../utils/constants'
import {
    RUBBER_MODE_KEY,
    GROUP_COMPONENT,
    DRAFT_STORAGE_KEY,
    ARROW_DRAW_MODE_KEY,
    TEXT_DRAW_MODE_KEY,
    PENDING_SHAPE_TYPE_KEY,
    PENDING_SHAPE_PROPS_KEY,
    LAST_ADDED_ELEMENT_ID_KEY,
    PENCIL_MODE_KEY,
    BACKGROUND_BASE_STORAGE_KEY,
    VIEWPORT_KEY_PREFIX,
    MOBILE_VIEWPORT_KEY_PREFIX,
    VIEWPORT_TTL_MS,
    BASE_TYPE_KEY_PREFIX,
    GEO_HIDDEN_TOOLS,
    GEO_VISIBILITY_RETRIES,
    GEO_VISIBILITY_MAX_FRAMES,
    DEFAULT_TEXT_SIZE,
    GEO_DRAW_MODE_KEY,
    GEO_DRAW_TYPE_KEY,
    GEO_DRAW_PROPS_KEY,
    GEO_POINT_PLACE_MODE_KEY,
    TEXT_EDIT_END_EVENT,
    TEXT_EDIT_START_EVENT,
    WELCOME_DISMISSED_KEY,
    LOCAL_BASE_ID_KEY,
} from '../../constants/misc'
import {
    isWelcomeComponent,
    playWelcomeSketchEntrance,
} from '../../utils/welcomeSketch'
import { useActiveBaseType } from '../../hooks/useActiveBaseType'
import { useDrawingModes } from '../../hooks/useDrawingModes'
import { useElementDefaults } from '../../hooks/useElementDefaults'
import { useMobileToolbarPanels } from '../../hooks/useMobileToolbarPanels'
import { useLocalDraftPersistence } from '../../hooks/useLocalDraftPersistence'
import { useElementCountWarning } from '../../hooks/useElementCountWarning'
import { PERFORMANCE_WARNING_THRESHOLD } from '../../utils/countBaseElements'
import Toast from '../../components/common/toast'
import {
    useComponentHistory,
    type HistoryEntry,
} from '../../hooks/useComponentHistory'
import { createApplyProperty } from '../../utils/applyProperty'
import { createApplyGroupProperty } from '../../utils/applyGroupProperty'
import type {
    BaseProps,
    BaseContextValue,
    ComponentRecord,
    ComponentStore,
    CameraChangeEvent,
} from '../../types/base'
import { BaseContext, useBaseContext } from './baseContext'

// Re-exported so existing importers (`from '.../views/Base/base'`) and the
// public lib.ts surface keep working — the canonical definition now lives in
// the stable baseContext module (see the comment there for the HMR rationale).
export { BaseContext, useBaseContext }

// Strips __typename fields injected by Apollo before sending data back to Hasura
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripTypename(obj: any): any {
    if (Array.isArray(obj)) return obj.map(stripTypename)
    if (obj && typeof obj === 'object') {
        const { __typename, ...rest } = obj
        return Object.fromEntries(
            Object.entries(rest).map(([k, v]) => [k, stripTypename(v)])
        )
    }
    return obj
}

/** Human-readable size for the live local-draft readout (UTF-8 bytes). */
const formatDraftBytes = (n: number): string => {
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
    return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

const BaseViewPage: React.FC<BaseProps> = (props) => {
    const routeParams = useParams()
    const baseIdFromUrl = routeParams.id
    const [localBaseId, setLocalBaseId] = useState(() => {
        if (baseIdFromUrl) return baseIdFromUrl
        // Reuse the baseId stored with the local draft so viewport persistence
        // keys stay stable across page refreshes in local (non-persisted) mode.
        try {
            const draft = localStorage.getItem(DRAFT_STORAGE_KEY)
            if (draft) {
                const parsed = JSON.parse(draft)
                if (parsed?.baseId) return parsed.baseId
            }
        } catch (_) {}
        // No draft yet — but the user may still have answered the map base's
        // start-location prompt, whose anchor and camera are keyed by this id.
        // The draft stays authoritative above; this only covers the gap where
        // something was persisted before anything was drawn.
        try {
            const remembered = localStorage.getItem(LOCAL_BASE_ID_KEY)
            if (remembered) return remembered
        } catch (_) {}
        return generateUUID()
    })
    const [isPersisted, setIsPersisted] = useState(!!baseIdFromUrl)
    const isPersistedRef = useRef(!!baseIdFromUrl)
    const baseId = baseIdFromUrl || localBaseId
    const [backgroundBaseId, setBackgroundBaseId] = useState<string | null>(
        null
    )
    const backgroundBaseIdRef = useRef<string | null>(null)
    const baseCreationInFlightRef = useRef<boolean>(false)

    /**
     * Claim a stable id for the local base at `/`.
     *
     * Called only when something worth reloading into has just been persisted
     * against this base — today, an answer to the map start-location prompt.
     * Deliberately not called on mount: a visit that touches nothing must leave
     * localStorage alone, the same promise the base-type sidecar makes.
     */
    const rememberLocalBaseId = useCallback((): void => {
        if (baseIdFromUrl) return
        try {
            localStorage.setItem(LOCAL_BASE_ID_KEY, localBaseId)
        } catch (_) {}
    }, [baseIdFromUrl, localBaseId])

    // Keep a claimed id in step with rotations (share, import), which mint a new
    // localBaseId. Guarded on the key already existing so this never claims one
    // on its own — a rotation is not a reason to start remembering.
    useEffect(() => {
        if (baseIdFromUrl) return
        try {
            if (localStorage.getItem(LOCAL_BASE_ID_KEY)) {
                localStorage.setItem(LOCAL_BASE_ID_KEY, localBaseId)
            }
        } catch (_) {}
    }, [localBaseId, baseIdFromUrl])

    const {
        loading: getComponentsForBaseLoading,
        data: getComponentsForBaseData,
        error: getComponentsForBaseError,
    } = useQuery(GET_COMPONENTS_FOR_BASE_QUERY, {
        variables: { baseId },
        fetchPolicy: 'cache-first',
        skip: !isPersisted,
    })

    const { data: getComponentTypesData } = useQuery(GET_COMPONENT_TYPES)

    const [insertComponent] = useMutation(INSERT_COMPONENT, {
        ignoreResults: true,
    })

    const [updateComponentInfo] = useMutation(UPDATE_COMPONENT_INFO, {
        ignoreResults: true,
    })

    const [
        deleteComponent,
        {
            loading: deleteComponentLoading,
            data: deleteComponentData,
            error: deleteComponentError,
        },
    ] = useMutation(DELETE_COMPONENT_BY_ID)

    const [deleteBulkComponents] = useMutation(DELETE_BULK_COMPONENTS)

    const [
        updateUserRevisit,
        {
            loading: updateUserRevisitLoading,
            data: updateUserRevisitData,
            error: updateUserRevisitError,
        },
    ] = useMutation(UPDATE_USER_REVISIT_COUNT)

    const [insertUser] = useMutation(INSERT_USER_ONE)

    const navigate = useNavigate()

    const [createBase, { loading: createBaseLoading, data: createBaseData }] =
        useMutation(CREATE_BASE)

    const [updateBaseVisibility] = useMutation(UPDATE_BASE_VISIBILITY)
    const [sharePersistedBase] = useMutation(SHARE_PERSISTED_BASE)

    const [insertBulkComponents] = useMutation(INSERT_BULK_COMPONENTS, {
        ignoreResults: true,
    })

    const [componentStore, setComponentStore] = useState<ComponentStore>({})

    const { showPerfWarning, dismissPerfWarning } = useElementCountWarning({
        componentStore,
        isPersisted,
        baseId,
    })

    const [lastAddedElement, setLastAddedElement] =
        useState<ComponentRecord | null>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [twoJSInstance, setTwoJSInstance] = useState<any>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [zuiInBase, setZuiInBase] = useState<any>(null)
    const [selectedComponent, setSelectedComponent] = useState<unknown>(null)
    const [selectedGroup, setSelectedGroup] = useState<unknown>(null)
    // Mirror of selectedGroup as a ref — useComponentHistory's applyBatch needs
    // to read the currently-focused group at undo/redo time without re-running.
    const selectedGroupRef = useRef<unknown>(null)
    // True while a selected element/group is actively being dragged or resized.
    // Used to hide the (fixed-position) properties toolbar so it doesn't sit
    // under the element mid-drag. Driven by a document-level pointer watcher
    // below; `selectionPresentRef` lets that DOM handler read the live selection
    // without re-binding on every selection change.
    const [isElementDragging, setIsElementDragging] = useState(false)
    const selectionPresentRef = useRef(false)
    const [currentElement, setCurrentElement] = useState<string | null>(null)
    const [showPermissionErrorModal, setShowPermissionErrorModal] =
        useState(false)
    const { isDesktop, isMobile, isLaptop, isTablet } = useMediaQueryUtils()

    const stateRefForComponentStore = useRef<ComponentStore>({})
    // newCanvas owns reorderSelected (it needs reconcileZOrder + the live zui
    // selection). It populates this ref on mount; the context exposes a stable
    // wrapper so the properties toolbar can trigger reordering too. No-op until
    // Canvas mounts.
    const reorderSelectedRef = useRef<
        ((op: 'front' | 'forward' | 'backward' | 'back') => void) | null
    >(null)
    const reorderSelected = useCallback(
        (op: 'front' | 'forward' | 'backward' | 'back'): void => {
            reorderSelectedRef.current?.(op)
        },
        []
    )
    // newCanvas owns fitToContent (it lives on the live zui handle). It
    // populates this ref on mount; the context exposes a stable wrapper so the
    // "Go to content" button can frame all elements. No-op until Canvas mounts.
    const fitToContentRef = useRef<(() => boolean) | null>(null)
    const fitToContent = useCallback(
        (): boolean => Boolean(fitToContentRef.current?.()),
        []
    )
    // Guards the one-shot welcome-sketch soft-land entrance.
    const welcomeEntrancePlayedRef = useRef(false)
    // Guards the one-shot welcome-sketch promotion so a burst of first adds only
    // promotes the sketch into real content once.
    const welcomePromotedRef = useRef(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const twoJSInstanceRef = useRef<any>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zuiInBaseRef = useRef<any>(null)
    const skipComponentStoreResetRef = useRef<boolean>(false)

    const {
        pointerToggle,
        setPointerToggle,
        isPencilMode,
        setPencilMode,
        isArrowDrawMode,
        setIsArrowDrawMode,
        isTextDrawMode,
        setIsTextDrawMode,
        isRubberMode,
        eraserSize,
        isPanMode,
        togglePanMode: togglePanModeFromHook,
        setArrowDrawModeInBase,
        setTextDrawModeInBase,
        setRubberModeInBase,
        setEraserSizeInBase,
        clearDrawModesFromStorage,
    } = useDrawingModes()

    // Active base type (board / map). Reads the base's persisted choice without
    // writing one, so bases that predate the switcher open exactly as before.
    const {
        activeBaseType,
        provider: baseTypeProvider,
        switchBaseType,
        handleCameraChange: handleBaseTypeCameraChange,
        captureBackdrop,
        readConfig: readBaseTypeConfigForExport,
        setMapAnchor,
        hadStoredMapAnchor,
    } = useActiveBaseType({
        baseId,
        defaultBaseType: props.defaultBaseType,
        serverConfig: props.serverBaseConfig,
        pinnedBaseType: props.pinnedBaseType,
    })

    /**
     * Deprecated `geoObjectsEnabled` compatibility.
     *
     * The flag predates bases and means exactly one thing: "surface the geo
     * toolset". It never implied a backdrop — the consumer always painted its
     * own map through `renderBackground`. So it must NOT map to the map base,
     * or craftmaps would end up with two maps stacked: craftbase's and its own.
     *
     * It therefore overlays the geo tooling on whatever base is active, leaving
     * the backdrop alone.
     */
    const toolset = useMemo(() => {
        if (!props.geoObjectsEnabled) {
            return {
                // Which base this toolset was actually built from. Providers are
                // dynamically imported, so `baseTypeProvider` lags `activeBaseType` by
                // however long the chunk takes to load — anything acting on a
                // base switch has to wait for these two to agree, or it acts on
                // the OUTGOING base's tools.
                baseId: baseTypeProvider.id,
                hiddenTools: baseTypeProvider.hiddenTools,
                extraTools: baseTypeProvider.extraTools,
                homeTool: baseTypeProvider.homeTool,
            }
        }
        return {
            baseId: baseTypeProvider.id,
            hiddenTools: GEO_HIDDEN_TOOLS,
            extraTools: geoElementData,
            homeTool: 'pan',
        }
    }, [baseTypeProvider, props.geoObjectsEnabled])

    // A consumer that paints its own backdrop owns the substrate; offering them
    // craftbase's switcher would stack a second one underneath. A pinned route
    // (`/map/:id`) owns it for a different reason: there the URL names the type,
    // so a switcher could only ever make the address bar lie.
    const baseTypeSwitcherEnabled =
        !props.renderBackground && !props.pinnedBaseType

    /**
     * Where a recipient of this shared map should land, resolved once at mount.
     *
     * Requires BOTH halves of the base row's geography: the anchor (which makes
     * the ink mean anything) and the landing view (the camera to open on). They
     * are always written together, so anything less is a hand-edited row and is
     * ignored rather than half-applied — Canvas then falls back to the saved
     * camera, exactly as it did before this existed.
     */
    const [initialMapLanding] = useState(() => {
        const anchor = props.serverBaseConfig?.mapAnchor
        const landing = props.serverBaseConfig?.landing
        if (!anchor || !landing) return null
        return { anchor, lngLat: landing.lngLat, zoom: landing.zoom }
    })

    /**
     * Each base shows only the content that belongs on it: geo objects are
     * hidden on the board base, whiteboard shapes/lines/pencil are hidden on
     * the map base, and plain text stays on both. Hidden, never deleted — the
     * records stay in the store, the draft and the DB.
     *
     * Runs on `componentStore` too, not just the base, because element
     * components mount lazily: on a page load the scene fills in after this
     * effect first fires. The retry window covers the gap between the store
     * settling and the last element landing in the Two.js scene.
     */
    const forceGeoVisible = Boolean(props.geoObjectsEnabled)

    // Live active base for callbacks that outlive the render they were created
    // in. `addToLocalComponentStore` is handed to `addZUI`, which runs once on
    // mount — so anything it calls reads mount-time state unless it goes through
    // a ref (see the stale-closure note in CLAUDE.md). `promoteWelcomeSketch` is
    // reached exactly that way.
    const activeBaseTypeRef = useRef<BaseType>(activeBaseType)
    useEffect(() => {
        activeBaseTypeRef.current = activeBaseType
    }, [activeBaseType])

    useEffect(() => {
        let cancelled = false
        let attempts = 0
        let frames = 0
        let lastSceneSize = -1

        const apply = (): void => {
            if (cancelled) return
            const two = twoJSInstanceRef.current
            if (two)
                applyBaseTypeVisibility(two, activeBaseType, {
                    forceGeoVisible,
                })

            // Keep re-applying until the scene stops growing, then for a short
            // quiet window after that. A fixed budget from the store change was
            // not enough: element components mount lazily, so on a big base
            // (or right after a share, which re-mounts the whole scene) the last
            // geo element could land after the window closed and never get
            // hidden — which is exactly how a route ends up on the whiteboard.
            const sceneSize = two?.scene?.children?.length ?? -1
            if (sceneSize !== lastSceneSize) {
                lastSceneSize = sceneSize
                attempts = 0
            }
            const keepGoing =
                attempts++ < GEO_VISIBILITY_RETRIES &&
                frames++ < GEO_VISIBILITY_MAX_FRAMES
            if (keepGoing) requestAnimationFrame(apply)
        }
        apply()

        return (): void => {
            cancelled = true
        }
    }, [activeBaseType, forceGeoVisible, componentStore])

    // The base's backdrop sync rides the same camera events the consumer prop
    // gets. Kept in a ref-free plain callback because Canvas stores it in a ref
    // of its own (see the stale-closure note in CLAUDE.md).
    const handleCameraChange = useCallback(
        (camera: CameraChangeEvent): void => {
            handleBaseTypeCameraChange(camera)
            props.onCameraChange?.(camera)
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [handleBaseTypeCameraChange, props.onCameraChange]
    )

    const { showMobileToolbarPanel, setShowMobileToolbarPanel } =
        useMobileToolbarPanels({ isMobile, selectedComponent })

    // Mobile-only ✓/✗ controls for the multi-click curved-line draw. There's no
    // Esc/Enter on touch, so the canvas signals the draw's start/end (via the
    // same lifecycle as the "press Esc/Enter" nudge) and we surface finish/cancel
    // buttons that dispatch back the equivalent events.
    const [showMultiClickDrawControls, setShowMultiClickDrawControls] =
        useState(false)
    useEffect(() => {
        const onStart = (): void => setShowMultiClickDrawControls(true)
        const onEnd = (): void => setShowMultiClickDrawControls(false)
        window.addEventListener('multiClickDrawStart', onStart)
        window.addEventListener('multiClickDrawEnd', onEnd)
        return (): void => {
            window.removeEventListener('multiClickDrawStart', onStart)
            window.removeEventListener('multiClickDrawEnd', onEnd)
        }
    }, [])

    // A text editor being open owns the same corner (its ✓/✗ live there), so
    // the delete button stands down for its duration — deleting the element you
    // are mid-sentence in is not what that tap means.
    const [isEditingText, setIsEditingText] = useState(false)
    useEffect(() => {
        const onStart = (): void => setIsEditingText(true)
        const onEnd = (): void => setIsEditingText(false)
        window.addEventListener(TEXT_EDIT_START_EVENT, onStart)
        window.addEventListener(TEXT_EDIT_END_EVENT, onEnd)
        return (): void => {
            window.removeEventListener(TEXT_EDIT_START_EVENT, onStart)
            window.removeEventListener(TEXT_EDIT_END_EVENT, onEnd)
        }
    }, [])

    const {
        // values
        defaultFill,
        defaultStrokeColor,
        defaultLinewidth,
        defaultStrokeType,
        defaultOpacity,
        defaultTextColor,
        defaultTextSize,
        defaultTextFontFamily,
        // raw setters (used by createApplyProperty + history)
        setDefaultFill,
        setDefaultStrokeColor,
        setDefaultLinewidth,
        setDefaultStrokeType,
        setDefaultOpacity,
        setDefaultTextColor,
        setDefaultTextSize,
        setDefaultTextFontFamily,
        // base-facing setters (kept for any external callers)
        setDefaultLinewidthInBase,
        setDefaultStrokeTypeInBase,
        resetDefaults,
    } = useElementDefaults()

    // Force the defaults on mount and on every theme toggle, overwriting any
    // prior pick: stroke/text → theme ink (#fff in dark, #000 in light), and
    // fill → transparent. Between toggles the user is free to pick any color from
    // the toolbar; the next toggle resets them again.
    useEffect(() => {
        const forceInkDefaults = (): void => {
            const ink = themeDefaultInk()
            setDefaultFill(TRANSPARENT_FILL)
            setDefaultStrokeColor(ink)
            setDefaultTextColor(ink)
        }
        forceInkDefaults()
        let prevDark = document.documentElement.classList.contains('dark')
        const obs = new MutationObserver(() => {
            const isDark = document.documentElement.classList.contains('dark')
            if (isDark === prevDark) return
            prevDark = isDark
            forceInkDefaults()
        })
        obs.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        })
        return () => obs.disconnect()
    }, [setDefaultFill, setDefaultStrokeColor, setDefaultTextColor])

    const onStorageLimitRef = useRef<(() => Promise<void>) | null>(null)
    // Write-side guard callback: assigned below once undoLastAction exists.
    const onDraftOverBudgetRef = useRef<(() => void) | null>(null)

    const {
        showStorageLimitModal,
        setShowStorageLimitModal,
        storageLimitBaseUrl,
        setStorageLimitBaseUrl,
        handleStartNewCanvas,
        handleContinueOnSavedBase,
        showBaseTooLargeModal,
        handleDownloadBaseBackup,
        handleStartFreshFromTooLarge,
        handleOpenBaseAnyway,
        draftSizeBytes,
    } = useLocalDraftPersistence({
        isPersisted,
        localBaseId,
        componentStore,
        setComponentStore,
        backgroundBaseIdRef,
        setBackgroundBaseId,
        onStorageLimitRef,
        onDraftOverBudgetRef,
        welcomeSketch: props.welcomeSketch,
        isMobile,
    })

    const {
        historyLog,
        historyLogRef,
        bucketLog,
        bucketLogRef,
        recordToHistoryLog,
        recordBatchToHistoryLog,
        undoLastAction,
        redoLastAction,
        clearHistory,
    } = useComponentHistory({
        twoJSInstanceRef,
        stateRefForComponentStore,
        isPersistedRef,
        baseId,
        isPersisted,
        insertComponent,
        deleteComponent,
        updateComponentInfo,
        setComponentStore,
        setShowPermissionErrorModal,
        setDefaultLinewidth,
        setDefaultStrokeType,
        selectedComponent,
        selectedGroupRef,
        stripTypename,
    })

    // Write-side size guard. The measurement lives in useLocalDraftPersistence
    // (real UTF-8 size of the persisted draft, after each save); when it's over
    // budget it calls this, and we revert the last action + open the "canvas is
    // full" modal. Skip when there's nothing to revert (a draft hydration or
    // "open anyway"), so the guard never fights a load it can't roll back.
    const [showBaseFullModal, setShowBaseFullModal] = useState(false)
    onDraftOverBudgetRef.current = (): void => {
        if (historyLogRef.current.length === 0) return
        undoLastAction()
        setShowBaseFullModal(true)
    }

    // Export the current base to a .json file — the "keep working elsewhere"
    // path offered by the canvas-full modal. Reads viewport off the live scene.
    const handleExportBaseFromModal = useCallback(() => {
        const scene = twoJSInstanceRef.current?.scene
        const viewport = scene
            ? {
                  scale: typeof scene.scale === 'number' ? scene.scale : 1,
                  tx: scene.translation.x,
                  ty: scene.translation.y,
              }
            : { scale: 1, tx: 0, ty: 0 }
        exportBaseAsJson(
            stateRefForComponentStore.current,
            viewport,
            readBaseTypeConfigForExport()
        )
        setShowBaseFullModal(false)
    }, [readBaseTypeConfigForExport])

    // ---- Board import (P0) ----
    // The chooser modal is driven by base state; the parsed file waits in a
    // ref until the user picks "Open as new" vs "Merge".
    const [showImportChooser, setShowImportChooser] = useState(false)
    const [importError, setImportError] = useState<string | null>(null)
    const pendingImportRef = useRef<ParsedImport | null>(null)

    // Set the camera absolutely to a saved viewport: reset to identity, then
    // zoom + translate (the fitToContent pattern in newCanvas). zoomSet keeps
    // ZUI's internal scale in sync — never set two.scene.scale directly.
    const restoreImportedViewport = useCallback((vp: BaseViewport): void => {
        const zui = zuiInBaseRef.current?.zui
        if (!zui) return
        try {
            zui.reset?.()
            zui.zoomSet(vp.scale, 0, 0)
            zui.translateSurface(vp.tx, vp.ty)
            twoJSInstanceRef.current?.update()
        } catch (e) {
            console.error('[import] viewport restore failed', e)
        }
    }, [])

    /**
     * Each base is its own workspace and keeps its own camera. On a switch we
     * bank the outgoing base's viewport and restore the incoming one — a base
     * that has never been visited opens at the identity camera.
     *
     * Note this is deliberately *not* "the view stays put across a switch":
     * panning around a map must not drag the whiteboard's view with it. Element
     * coordinates are still untouched; only the camera differs per base.
     */
    const prevBaseTypeRef = useRef<BaseType>(activeBaseType)
    useEffect(() => {
        const previous = prevBaseTypeRef.current
        if (previous === activeBaseType) return
        prevBaseTypeRef.current = activeBaseType

        const two = twoJSInstanceRef.current
        const scene = two?.scene
        if (scene && baseId) {
            writeViewport(baseId, previous, isMobile, {
                scale: typeof scene.scale === 'number' ? scene.scale : 1,
                tx: scene.translation.x,
                ty: scene.translation.y,
            })
        }

        // Hand the camera the incoming base's zoom range BEFORE restoring its
        // viewport — the map's range reaches far below the board base's floor, and a
        // stale floor would clamp a wide map camera on the way in.
        //
        // Read from the static table, NOT `baseTypeProvider`: providers load through
        // a dynamic import, so on a switch `baseTypeProvider` still describes the
        // base being LEFT. Using it here would install the board base's floor and
        // clamp the very map camera this line exists to protect.
        const incomingLimits = zoomLimitsForBaseType(activeBaseType)
        zuiInBaseRef.current?.setZoomLimits?.(
            incomingLimits.min,
            incomingLimits.max
        )

        restoreImportedViewport(
            (baseId && readViewport(baseId, activeBaseType, isMobile)) ||
                IDENTITY_VIEWPORT
        )
        // The backdrop tracks onCameraChange, and this camera move happens
        // outside addZUI's handlers — announce it or the map stays put.
        zuiInBaseRef.current?.notifyCameraChange?.()
    }, [activeBaseType, baseId, isMobile, restoreImportedViewport])

    // Belt-and-braces re-apply once the camera exists. newCanvas already
    // installs the active base's range before restoring the saved viewport;
    // this covers any later path that recreates the camera.
    //
    // Keyed on `activeBaseType` via the static table rather than on `baseTypeProvider`.
    // It used to read the provider, which meant this effect fired on first
    // render with the still-unresolved board base and re-clamped a just-restored
    // map camera back to the whiteboard's 6% floor — undoing the restore it was
    // meant to complete.
    useEffect(() => {
        const limits = zoomLimitsForBaseType(activeBaseType)
        zuiInBaseRef.current?.setZoomLimits?.(limits.min, limits.max)
    }, [activeBaseType, zuiInBase])

    // Grab affordance for the map base's empty-canvas drag-to-pan (common.css).
    // Gated on the select tool specifically, not merely "no draw mode": with a
    // geo tool armed the next drag authors an object, and a grab cursor would
    // be promising the wrong gesture.
    useEffect(() => {
        const root = document.getElementById('main-two-root')
        if (!root) return
        root.classList.toggle(
            'map-drag-pan',
            activeBaseType === 'map' && currentElement === 'pointer'
        )
    }, [activeBaseType, currentElement])

    // Re-glue every docked connector whose bound shape is present in `store`.
    // The listener in newCanvas polls for fresh mounts, so dispatching now
    // (before the elements mount) is safe.
    const restackBoundPortsForStore = useCallback(
        (store: ComponentStore): void => {
            const ports: { shapeId: string; edge: string }[] = []
            Object.values(store).forEach((r) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const rec = r as any
                ;(['tail', 'head'] as const).forEach((end) => {
                    const sid = rec[`${end}ShapeId`]
                    const edge = rec[`${end}Edge`]
                    if (
                        typeof sid === 'string' &&
                        store[sid] &&
                        typeof edge === 'string'
                    ) {
                        ports.push({ shapeId: sid, edge })
                    }
                })
            })
            if (ports.length > 0) {
                window.dispatchEvent(
                    new CustomEvent('restackPorts', { detail: { ports } })
                )
            }
        },
        []
    )

    // Replace the whole canvas with the imported base and rotate the local
    // base id. Mirrors clearBase's teardown + persistBase's id rotation.
    const importAsNewCanvas = useCallback(
        (parsed: ParsedImport): void => {
            window.dispatchEvent(new Event('clearSelector'))
            setSelectedComponent(null)
            twoJSInstanceRef.current?.clear()
            twoJSInstanceRef.current?.update()

            const newLocalId = generateUUID()
            const store: ComponentStore = {}
            Object.entries(parsed.components).forEach(([id, comp]) => {
                store[id] = { ...comp, baseId: newLocalId }
            })
            stateRefForComponentStore.current = store
            // Rotate localBaseId without the id-change effect wiping the store.
            skipComponentStoreResetRef.current = true
            setLocalBaseId(newLocalId)
            setComponentStore(store)
            clearHistory(isPersisted)

            if (parsed.viewport) restoreImportedViewport(parsed.viewport)
            restackBoundPortsForStore(store)
        },
        [isPersisted, restoreImportedViewport, restackBoundPortsForStore]
    )

    // Merge the imported base into the current canvas: re-key every id to a
    // fresh UUID (so it can't collide), remap in-file port bindings to the
    // clones (drop bindings to shapes not in the file), and stack on top. One
    // BATCH entry so a single undo removes the whole import.
    const mergeImportedBase = useCallback(
        (parsed: ParsedImport): void => {
            const records = Object.values(parsed.components)
            // Add in ascending original z-order so the assigned positions
            // preserve the imported set's relative stacking.
            records.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

            // Precompute the current top position ONCE. Passing explicit
            // positions makes addToLocalComponentStore skip its per-add O(n)
            // max-scan — otherwise a bulk merge is O(n²) and freezes.
            const baseMax = Object.values(
                stateRefForComponentStore.current
            ).reduce((m: number, c) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const p = (c as any)?.position
                return Number.isFinite(p) ? Math.max(m, p) : m
            }, 0)

            const idMap = new Map<string, string>()
            records.forEach((r) => idMap.set(r.id, generateUUID()))

            const batch: HistoryEntry[] = []
            const ports: { shapeId: string; edge: string }[] = []
            records.forEach((r, i) => {
                const newId = idMap.get(r.id) as string
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const cloned: any = { ...r, id: newId, baseId }
                // Explicit top position, in sorted order — O(1) per add.
                cloned.position = baseMax + i + 1
                ;(['tail', 'head'] as const).forEach((end) => {
                    const boundId = cloned[`${end}ShapeId`]
                    if (typeof boundId !== 'string') return
                    const mapped = idMap.get(boundId)
                    if (mapped) {
                        cloned[`${end}ShapeId`] = mapped
                        const edge = cloned[`${end}Edge`]
                        if (typeof edge === 'string') {
                            ports.push({ shapeId: mapped, edge })
                        }
                    } else {
                        cloned[`${end}ShapeId`] = null
                        cloned[`${end}Edge`] = null
                        cloned[`${end}PortIndex`] = 0
                    }
                })
                addToLocalComponentStore(
                    newId,
                    cloned.componentType,
                    cloned,
                    true
                )
                batch.push({
                    action: 'ADD',
                    id: newId,
                    componentInfo: { ...cloned },
                })
            })
            if (batch.length > 0) recordBatchToHistoryLog(batch)
            if (ports.length > 0) {
                window.dispatchEvent(
                    new CustomEvent('restackPorts', { detail: { ports } })
                )
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [baseId]
    )

    const beginBaseImport = useCallback(async (): Promise<void> => {
        const text = await openBaseFilePicker()
        if (text == null) return // cancelled
        try {
            const parsed = parseImportedBase(text)
            if (Object.keys(parsed.components).length === 0) {
                pendingImportRef.current = null
                setImportError('This file has no readable canvas elements.')
            } else {
                pendingImportRef.current = parsed
                setImportError(null)
            }
        } catch (e) {
            pendingImportRef.current = null
            setImportError(
                e instanceof Error ? e.message : 'Could not read this file.'
            )
        }
        setShowImportChooser(true)
    }, [])

    // Reject an import that can't fit BEFORE applying it. Applying then letting
    // the write-side guard revert a too-large import is what froze the page —
    // so gate here (against the browser's REAL localStorage quota) and keep the
    // modal in its error state instead.
    const rejectIfWontFit = useCallback(
        (projected: ComponentStore): boolean => {
            if (draftFitsForStore(projected)) return false
            setImportError(
                "This canvas is too large to fit in this browser's local storage. " +
                    'Browsers store canvas text at roughly twice its file size and ' +
                    'cap local storage near 5 MB, so very large canvases can’t be ' +
                    'saved locally. Try a smaller one, or split it across canvases.'
            )
            return true
        },
        []
    )

    const handleImportOpenAsNew = useCallback(() => {
        const parsed = pendingImportRef.current
        if (!parsed) {
            setShowImportChooser(false)
            return
        }
        if (rejectIfWontFit(parsed.components)) return // stay open, show error
        setShowImportChooser(false)
        pendingImportRef.current = null
        importAsNewCanvas(parsed)
    }, [importAsNewCanvas, rejectIfWontFit])

    const handleImportMerge = useCallback(() => {
        const parsed = pendingImportRef.current
        if (!parsed) {
            setShowImportChooser(false)
            return
        }
        // Project the merged result (current store + imported) and gate on it.
        const projected: ComponentStore = {
            ...stateRefForComponentStore.current,
            ...parsed.components,
        }
        if (rejectIfWontFit(projected)) return // stay open, show error
        setShowImportChooser(false)
        pendingImportRef.current = null
        mergeImportedBase(parsed)
    }, [mergeImportedBase, rejectIfWontFit])

    const handleImportChooserClose = useCallback(() => {
        setShowImportChooser(false)
        pendingImportRef.current = null
        setImportError(null)
    }, [])

    // Clear stale interaction flags from localStorage on mount so a page refresh
    // never triggers SCENARIO_DRAW_SHAPE / SCENARIO_ARROW_DRAW / etc. on the
    // first mousedown. These keys are only meaningful within a single page session.
    //
    // This parent effect runs AFTER the child shapesToolbar effect that sets the
    // pan default, so the sweep above (which clears PAN_MODE_KEY) would otherwise
    // wipe it out — leaving pan highlighted but inert. Re-activate it here so the
    // pan default actually takes effect when geo objects are enabled.
    useEffect(() => {
        clearDrawModesFromStorage()
        if (toolset.homeTool === 'pan') togglePanMode(true)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Sweep viewport and base entries older than VIEWPORT_TTL_MS or missing
    // savedAt. Each new local draft writes its own craftbase_viewport_<id> key
    // (and, once the user picks a base, craftbase_base_<id>); without this
    // sweep, localStorage accumulates dead entries indefinitely.
    //
    // BASE_TYPE_KEY_PREFIX is matched *additively* alongside the viewport prefixes —
    // all three share the same savedAt/TTL shape. Take care here: broadening
    // this match incorrectly would evict every base's saved camera.
    useEffect(() => {
        try {
            const now = Date.now()
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i)
                if (
                    !key ||
                    (!key.startsWith(VIEWPORT_KEY_PREFIX) &&
                        !key.startsWith(MOBILE_VIEWPORT_KEY_PREFIX) &&
                        !key.startsWith(BASE_TYPE_KEY_PREFIX))
                )
                    continue
                try {
                    const parsed = JSON.parse(
                        localStorage.getItem(key) ?? 'null'
                    )
                    if (
                        !parsed?.savedAt ||
                        now - parsed.savedAt > VIEWPORT_TTL_MS
                    ) {
                        localStorage.removeItem(key)
                    }
                } catch (_) {
                    localStorage.removeItem(key)
                }
            }
        } catch (_) {}
    }, [])

    // Reset component store whenever the base changes (persisted mode only).
    // In local mode the baseId is a stable UUID and draft restore handles initialization.
    // skipComponentStoreResetRef lets persistBase() rotate localBaseId without wiping the store.
    const prevBaseIdRef = useRef(baseId)
    useEffect(() => {
        if (prevBaseIdRef.current !== baseId) {
            if (!skipComponentStoreResetRef.current) {
                setComponentStore({})
            }
            skipComponentStoreResetRef.current = false
            prevBaseIdRef.current = baseId
        }
    }, [baseId])

    // Update revisit count on every base open, persisted or local.
    // A null payload means there's no revisit row for this userId — i.e.
    // the user was never created in this DB. Self-heal by inserting the
    // user with the known id; the `after_user_insert` Postgres trigger
    // then creates the revisits row (count = 1) for this visit.
    useEffect(() => {
        const userId = localStorage.getItem('userId')
        if (!userId) return
        // Capture the revisit moment client-side as an ISO 8601 string;
        // Hasura coerces it into the timestamptz `last_visit` column for
        // cohort analysis in the DB.
        updateUserRevisit({
            variables: { userId, lastVisit: new Date().toISOString() },
        })
            .then(({ data }) => {
                if (data?.update_users_user_revisits_by_pk) return
                const { nickname, firstName, lastName } =
                    generateRandomUsernames()
                return insertUser({
                    variables: {
                        object: { id: userId, nickname, firstName, lastName },
                    },
                })
            })
            .catch(() => {
                // Non-blocking: revisit tracking is best-effort and must
                // never break base mount (network/permission/conflict).
            })
    }, [])

    // Track last opened base only once it's persisted
    useEffect(() => {
        if (isPersisted && baseId) {
        }
    }, [isPersisted])

    useEffect(() => {
        if (
            !getComponentsForBaseLoading &&
            getComponentsForBaseData &&
            getComponentsForBaseData.components
        ) {
            if (getComponentsForBaseData.components.length > 0) {
                const baseComponentStore: ComponentStore = { ...componentStore }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                getComponentsForBaseData.components.forEach((item: any) => {
                    baseComponentStore[item.id] = item as ComponentRecord
                })
                setComponentStore(baseComponentStore)
            }
        }
    }, [getComponentsForBaseData])

    useEffect(() => {
        isPersistedRef.current = isPersisted
    }, [isPersisted])

    // Warm the core element chunks once the base is idle after mount, so the
    // first use of any of them finds its chunk already cached (the per-arm
    // prefetch in primary.tsx still covers the quick-draw race). Best-effort:
    // gated on idle so it never competes with initial paint/base-load.
    //
    // `groupobject` is included because group-selection lazy-loads it on
    // demand; without warming, the group can't mount until its ~580ms (Slow 4G)
    // chunk arrives, leaving the selected elements invisible — the group-select
    // "blink". Geo-only components (point/area/route/geoText/cluster) are left
    // out; warm them separately if/when geo mode needs it.
    useEffect(() => {
        const CORE_ELEMENT_CHUNKS = [
            'rectangle',
            'circle',
            'diamond',
            'arrowLine',
            'divider',
            'pencil',
            'newText',
            'groupobject',
        ]
        const warm = (): void => {
            CORE_ELEMENT_CHUNKS.forEach(prefetchElementModule)
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ric = (window as any).requestIdleCallback as
            ((cb: () => void, opts?: { timeout: number }) => number) | undefined
        if (ric) {
            const handle = ric(warm, { timeout: 3000 })
            return (): void => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ;(window as any).cancelIdleCallback?.(handle)
            }
        }
        const t = setTimeout(warm, 1500)
        return (): void => clearTimeout(t)
    }, [])

    useEffect(() => {
        console.log('change in componentStore in Board', componentStore)
        stateRefForComponentStore.current = componentStore
    }, [componentStore])

    // One-shot soft-land entrance for the welcome sketch. Fires once the seeded
    // welcome elements are in the store AND the Two.js instance is live; the
    // animation polls per-element for its mounted node, so this only needs to
    // catch the first time both conditions hold.
    useEffect(() => {
        if (welcomeEntrancePlayedRef.current) return
        const two = twoJSInstanceRef.current
        if (!two) return
        const hasWelcome = Object.values(componentStore).some((comp) =>
            isWelcomeComponent(comp)
        )
        if (!hasWelcome) return
        welcomeEntrancePlayedRef.current = true
        playWelcomeSketchEntrance(two, componentStore)
    }, [componentStore, twoJSInstance])

    // NOTE: the persisted-base loading gate lives in the parent
    // (views/Base/index.tsx). Never add a conditional `return` here — this
    // component runs hundreds of hooks below this point and an early return
    // changes the hook count between renders (Rules of Hooks violation).

    const setRootCursor = (cursor: string) => {
        const root = document.getElementById('main-two-root')
        if (root) root.style.cursor = cursor
    }

    const updateLastAddedElement = (obj: unknown) => {
        setLastAddedElement(obj as ComponentRecord | null)
        setRootCursor('crosshair')
    }

    const togglePointer = (pointerVal: boolean) => {
        setPointerToggle(pointerVal)
        setPencilMode(false)
        if (pointerVal) {
            cancelPendingElement()
            setSelectedComponent(null)
            setRubberModeInBase(false)
            setRootCursor('default')
        }
    }

    const togglePencilMode = (value: boolean) => {
        setPencilMode(value)
        if (value) {
            cancelPendingElement()
            setRubberModeInBase(false)
            localStorage.setItem(PENCIL_MODE_KEY, 'TRUE')
            setRootCursor('crosshair')
        } else {
            localStorage.removeItem(PENCIL_MODE_KEY)
        }
    }

    const togglePanMode = (value: boolean) => {
        togglePanModeFromHook(value, {
            cancelPendingElement,
            setSelectedComponent,
            toggleToolbar: setShowMobileToolbarPanel,
        })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setTwoJSInstanceInBase = (two: any) => {
        twoJSInstanceRef.current = two
        setTwoJSInstance(two)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setZuiInstanceInBase = (zuiInst: any) => {
        zuiInBaseRef.current = zuiInst
        setZuiInBase(zuiInst)
    }

    const setSelectedComponentInBase = (shape: unknown) => {
        setSelectedComponent(shape ?? null)
    }

    /**
     * Travel to a searched place.
     *
     * The map base georeferences the base through a SINGLE anchor: surface
     * (0,0) is `anchor.lngLat`, and every element's surface coordinates mean a
     * real place only in relation to it. Moving the anchor therefore re-points
     * the entire base at new geography while the ink stays put — a route drawn
     * around Satellite, Ahmedabad reappears in Virginia because it was never
     * "in Ahmedabad", it was 500px from wherever the anchor happened to be.
     *
     * So the anchor is written once and then left alone, and travelling is a
     * CAMERA move: the place's lng/lat resolves to a fixed surface point (pure
     * Mercator arithmetic against the anchor — see mercator.ts) and we fly the
     * viewport there across what is, in effect, a world-sized canvas.
     *
     * The one time re-anchoring is right is an empty map: with nothing drawn
     * there is no geography to betray, and re-anchoring re-centres the ZUI's
     * usable zoom window (~[anchor.zoom − 4.1, +3]) on where the user actually
     * is, instead of stranding them at the edge of a window centred half a
     * world away.
     */
    /**
     * Put the map base in pan mode.
     *
     * Called wherever we hand the user a NEW VIEW they did not navigate to
     * themselves — a search pick, the first-run location prompt. Landing
     * somewhere unfamiliar, the first thing anyone does is look around, and on a
     * map "look around" is the pan tool; leaving them in a draw or select tool
     * meant the first drag either drew something or dragged an element. `pan`
     * has to be set as the current element too, or the toolbar highlights one
     * tool while the canvas is in another.
     */
    const enterPanMode = useCallback((): void => {
        togglePanMode(true)
        setCurrentElement('pan')
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const goToPlace = useCallback(
        (place: MapAnchor): void => {
            const anchor = readBaseTypeConfigForExport().mapAnchor
            const store = stateRefForComponentStore.current ?? {}
            const mapHasContent = Object.values(store).some(
                (record) =>
                    record?.componentType !== GROUP_COMPONENT &&
                    isRecordVisibleOnBaseType(record, 'map')
            )

            if (!anchor || !mapHasContent) {
                setMapAnchor(place)
                // The place IS surface (0,0) now, and syncMapToZui puts surface
                // (0,0) at screen (tx, ty) — which on an untouched camera is the
                // top-left corner, not the middle. Centre it explicitly so
                // "start here" actually lands here. Scale 1 is required, not
                // cosmetic: mapZoom = anchor.zoom + log2(scale), so anything
                // else would show a different zoom than the one just chosen.
                // This also fires onCameraChange, which is what writes the
                // viewport — the camera and the anchor land in storage together.
                zuiInBaseRef.current?.centerOnSurface?.(0, 0, 1)
                enterPanMode()
                return
            }

            const { x, y } = lngLatToSurface(place.lngLat, anchor)
            zuiInBaseRef.current?.centerOnSurface?.(
                x,
                y,
                scaleForMapZoom(place.zoom, anchor)
            )
            enterPanMode()
        },
        [readBaseTypeConfigForExport, setMapAnchor, enterPanMode]
    )

    /**
     * First-visit "where are you mapping?" prompt.
     *
     * Deliberately narrow — it may only fire while re-anchoring is still a free
     * action. Three conditions, all necessary:
     *
     *  1. We are on the map base (nothing to ask otherwise).
     *  2. The base has never persisted an anchor. Note this reads the value
     *     snapshotted at load, not the live one: the provider fills in a
     *     timezone guess the moment it mounts, so the live config always has an
     *     anchor and would never let the prompt through.
     *  3. Nothing is on the map yet. This is the one that really matters —
     *     re-anchoring moves the geography UNDER the ink (element coordinates
     *     never change across an anchor change), so asking after something has
     *     been drawn would offer to silently relocate it. Same predicate
     *     goToPlace uses to decide re-anchor vs. fly-the-camera, for exactly
     *     the same reason.
     *
     * `askedRef` keeps it to once per session, so toggling bases repeatedly
     * before answering doesn't re-open it. Across sessions, answering EITHER
     * way persists an anchor, which retires condition 2 permanently — that is
     * what makes "Skip" stick rather than nag on the next visit.
     */
    const [showMapStartModal, setShowMapStartModal] = useState(false)
    const askedMapStartRef = useRef(false)
    // True only between opening the prompt and the user answering it. Both
    // answers write persisted state, so neither may run on a stray invocation —
    // and one already did: a leaked Escape handler in Modal (since fixed) called
    // onSkip long after the dialog was gone, re-anchoring a map the user had
    // already placed. Defence in depth, because "a dismissed dialog silently
    // moved my map" is not a failure the user can diagnose.
    const mapStartPendingRef = useRef(false)
    const [timezoneCity] = useState(() => resolveTimezoneCity())

    useEffect(() => {
        if (askedMapStartRef.current) return
        if (activeBaseType !== 'map') return
        if (hadStoredMapAnchor) return
        // Wait for the map provider to actually be live, so a "Skip" has
        // something to persist against.
        if (baseTypeProvider.id !== 'map') return

        const store = stateRefForComponentStore.current ?? {}
        const mapHasContent = Object.values(store).some(
            (record) =>
                record?.componentType !== GROUP_COMPONENT &&
                isRecordVisibleOnBaseType(record, 'map')
        )
        if (mapHasContent) return

        askedMapStartRef.current = true
        mapStartPendingRef.current = true
        setShowMapStartModal(true)
    }, [activeBaseType, hadStoredMapAnchor, baseTypeProvider, componentStore])

    /**
     * Commit the timezone city as this base's real anchor.
     *
     * Shared by "Skip" and by every failed location lookup. Both are decisions,
     * not silence: persisting an anchor is what retires the prompt for good, so
     * the user is never asked the same question twice on the same base.
     */
    const settleOnTimezoneCity = useCallback((): void => {
        setMapAnchor({
            lngLat: [...timezoneCity.lngLat],
            zoom:
                readBaseTypeConfigForExport().mapAnchor?.zoom ??
                DEFAULT_ANCHOR_ZOOM,
        })
        // Same reason as the re-anchor branch of goToPlace: the city is surface
        // (0,0), which an untouched camera parks in the top-left corner. "Use
        // Ahmedabad" should show Ahmedabad, and centring is also what fires
        // onCameraChange and gets the viewport written alongside the anchor.
        zuiInBaseRef.current?.centerOnSurface?.(0, 0, 1)
        enterPanMode()
        rememberLocalBaseId()
    }, [
        setMapAnchor,
        timezoneCity,
        readBaseTypeConfigForExport,
        rememberLocalBaseId,
        enterPanMode,
    ])

    const handleMapStartPick = useCallback(
        (place: MapAnchor): void => {
            if (!mapStartPendingRef.current) return
            mapStartPendingRef.current = false
            setShowMapStartModal(false)
            // The map is empty (that is the gate), so this re-anchors rather
            // than flying the camera — which is what we want: the whole zoom
            // window re-centres on the chosen place.
            goToPlace(place)
            rememberLocalBaseId()
        },
        [goToPlace, rememberLocalBaseId]
    )

    /**
     * A location lookup failed (denied, timed out, or unsupported).
     *
     * Settles the base on the timezone city so it is never left anchor-less,
     * but deliberately leaves `mapStartPendingRef` set and the dialog open: the
     * user has not answered yet, they were only refused by their browser. They
     * can still search, and a later pick re-anchors the (still empty) map.
     */
    const handleMapStartFallback = useCallback((): void => {
        if (!mapStartPendingRef.current) return
        settleOnTimezoneCity()
    }, [settleOnTimezoneCity])

    const handleMapStartSkip = useCallback((): void => {
        if (!mapStartPendingRef.current) return
        mapStartPendingRef.current = false
        setShowMapStartModal(false)
        // Persist the timezone city they are already looking at. Declining is a
        // decision, so we record it and stop asking, rather than treating it as
        // "unanswered" and re-prompting forever.
        settleOnTimezoneCity()
    }, [settleOnTimezoneCity])

    // Creates a base in the background on first interaction (non-blocking).
    // Stores the server base ID in state + ref + localStorage for later use.
    const ensureBackgroundBase = async () => {
        if (isPersistedRef.current) return
        if (backgroundBaseIdRef.current) return
        if (baseCreationInFlightRef.current) return

        baseCreationInFlightRef.current = true
        try {
            const userId = localStorage.getItem('userId')
            const { data: baseData } = await createBase({
                variables: { object: {} },
            })
            const newBaseId = baseData?.base?.id
            if (!newBaseId) return
            backgroundBaseIdRef.current = newBaseId
            setBackgroundBaseId(newBaseId)
            localStorage.setItem(BACKGROUND_BASE_STORAGE_KEY, newBaseId)
        } catch (e) {
            console.error('Background base creation failed:', e)
        } finally {
            baseCreationInFlightRef.current = false
        }
    }

    // On the user's first real interaction, the welcome sketch stops being
    // onboarding scaffolding and becomes the user's own content: we strip the
    // `isWelcome`/`welcomeRole` tags so the elements are no longer filtered out
    // of draft saves + share-time persistence (see useLocalDraftPersistence +
    // the persist filter below). They simply stay on the canvas as-is — no fade,
    // no removal — and are saved, persisted, and deletable like anything the
    // user drew. Guarded so a burst of first adds only promotes once.
    const promoteWelcomeSketch = (): void => {
        if (welcomePromotedRef.current) return
        // Promotion only makes sense on the base the sketch actually renders on.
        // The sketch is whiteboard onboarding, so it is hidden on every other
        // base — and promoting it there would hand the user "their own content"
        // they have never seen.
        //
        // It also used to silently change what the element IS to the
        // visibility rule, back when text was universal and `isWelcomeComponent`
        // was the only thing holding the sketch's copy off the map. Text is now
        // scoped per record and the sketch carries `baseTypeScope: 'board'`, so
        // that hazard is covered twice over — but promoting off-board is still
        // wrong for the reason above, so the guard stays.
        // Read through the ref: this is called from `addToLocalComponentStore`,
        // which the canvas captured at mount.
        if (activeBaseTypeRef.current !== 'board') return
        const welcomeIds = Object.keys(
            stateRefForComponentStore.current
        ).filter((id) =>
            isWelcomeComponent(stateRefForComponentStore.current[id])
        )
        if (welcomeIds.length === 0) return

        welcomePromotedRef.current = true
        // The sketch now lives in the draft, so it must not be re-seeded on the
        // next visit.
        localStorage.setItem(WELCOME_DISMISSED_KEY, '1')

        const two = twoJSInstanceRef.current
        const next = { ...stateRefForComponentStore.current }
        welcomeIds.forEach((id) => {
            const comp = next[id]
            if (!comp) return
            // Drop only the welcome tags; everything else (opacity, text
            // content, etc.) carries over so the element renders unchanged but
            // isWelcomeComponent() no longer matches it.
            const {
                isWelcome: _isWelcome,
                welcomeRole: _welcomeRole,
                ...restMeta
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } = (comp.metadata ?? {}) as any
            next[id] = { ...comp, metadata: restMeta }
            // Keep the live Two.js node's bookkeeping in sync in case anything
            // reads the welcome flag off elementData.
            const el = two?.scene.children.find(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (child: any) => child?.elementData?.id === id
            )
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const meta = (el as any)?.elementData?.metadata
            if (meta) {
                delete meta.isWelcome
                delete meta.welcomeRole
            }
        })
        stateRefForComponentStore.current = next
        setComponentStore(next)
    }

    // Records ADD action, updates store and syncs to DB
    const addToLocalComponentStore = (
        id: string,
        type: string,
        componentInfo: ComponentRecord,
        skipHistory: boolean = false
    ) => {
        // groupobject is a transient visual construct and must never be persisted
        if (
            type === GROUP_COMPONENT ||
            componentInfo?.componentType === GROUP_COMPONENT
        ) {
            return
        }

        // Strip transient grouping coords — not part of DB schema
        const {
            relativeX: _rX,
            relativeY: _rY,
            ...safeInfo
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } = (componentInfo ?? {}) as any

        // Assign a z-order position so the element renders deterministically
        // (and survives a refresh). New elements go on top: max(position)+1.
        // Computed from the synchronous ref — not `componentStore` state —
        // so back-to-back adds (rapid drawing, multi-paste) get increasing
        // positions instead of colliding. A pre-set position is preserved so
        // undo-of-delete and clipboard paste keep their original stacking.
        if (safeInfo.position == null) {
            const maxPos = Object.values(
                stateRefForComponentStore.current
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ).reduce((m: number, c: any) => {
                const p = c?.position
                return Number.isFinite(p) ? Math.max(m, p) : m
            }, 0)
            safeInfo.position = maxPos + 1
        }

        // User's first real element promotes the onboarding sketch into real,
        // persisted content (it stays on the canvas rather than vanishing).
        // Welcome elements are seeded via setComponentStore directly (never
        // through this path), so any add here is by definition "real" content.
        if (!isWelcomeComponent(safeInfo as ComponentRecord)) {
            promoteWelcomeSketch()
        }

        // Trigger background base creation on first interaction
        ensureBackgroundBase()

        if (!skipHistory) {
            recordToHistoryLog({
                action: 'ADD',
                id,
                componentInfo: safeInfo,
            })
        }

        const updatedComponentStore = {
            ...stateRefForComponentStore.current,
            [id]: safeInfo,
        }
        stateRefForComponentStore.current = updatedComponentStore
        setComponentStore(updatedComponentStore)

        if (isPersistedRef.current && safeInfo) {
            insertComponent({ variables: { object: safeInfo } }).catch(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (error: any) => {
                    const isPermissionError = error.graphQLErrors?.some(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (e: any) => e.extensions?.code === 'permission-error'
                    )
                    if (isPermissionError) {
                        undoLastAction()
                        setShowPermissionErrorModal(true)
                    }
                }
            )
        }
    }

    // Builds a text-element shapeData object using the dynamic defaults
    // returned by GET_COMPONENT_TYPES (so dblclick/T-key paths produce the
    // exact same shape the sidebar Text button does).
    const buildTextShapeData = (
        id: string,
        x: number,
        y: number,
        // 'newText' is the standard whiteboard text; 'geoText' is the
        // zoom-resistant map variant (counter-scales like a point pin).
        componentType: 'newText' | 'geoText' = 'newText'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): any | null => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let typeItem: any = null
        if (getComponentTypesData) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            getComponentTypesData.componentTypes.forEach((item: any) => {
                if (item.label === 'text') typeItem = item
            })
        }
        // Fallback when the Hasura catalog isn't reachable — keeps text
        // creation working when craftbase runs standalone as a library.
        if (!typeItem) {
            typeItem = {
                width: 120,
                height: 36,
                fill: 'transparent',
                textColor: '#3A342C',
                metadata: {},
            }
        }
        const userId = localStorage.getItem('userId')
        const sizesMap = isMobile ? MOBILE_TEXT_SIZES_OBJECT : TEXT_SIZES_OBJECT
        const fontSizePx =
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (sizesMap as any)[defaultTextSize] ?? typeItem.metadata?.fontSize
        return {
            id,
            componentType,
            // geoText is anchored to the map, so flag it geo (mirrors point/
            // area/route). It renders exactly like newText — the flag is what
            // keeps it on the map base and off the board base.
            ...(componentType === 'geoText' && { objectClass: 'geo' }),
            linewidth: defaultLinewidth,
            strokeType: defaultStrokeType,
            children: {},
            metadata: {
                ...(typeItem.metadata || {}),
                ...(fontSizePx !== undefined && { fontSize: fontSizePx }),
                ...(defaultTextFontFamily && {
                    textFontFamily: defaultTextFontFamily,
                }),
                // Pin this text to the base type it was authored on. Text is the
                // one element family with no type-level home: shapes are covered
                // by BOARD_ONLY_TYPES and geo objects by `objectClass`, but text
                // fell through every rule to the catch-all `return true` and so
                // leaked onto every base type. Recording the author's intent per
                // record is the rule that generalises — a future image base gets
                // correct scoping for free, with no new branch in the rule.
                baseTypeScope: activeBaseTypeRef.current,
                opacity: 1,
            },
            x: Math.trunc(x),
            y: Math.trunc(y),
            x2: 0,
            baseId: baseId,
            width: typeItem.width,
            height: typeItem.height,
            fill: typeItem.fill,
            textColor: defaultTextColor ?? typeItem.textColor,
            updatedBy: userId,
        }
    }

    /**
     * Which text element the *current* toolset means by "text". A geo-flavoured
     * toolset hides the plain Text tool and offers `geoText` in its place (see
     * GEO_HIDDEN_TOOLS), so every text-creation entry point must follow that
     * swap — otherwise text made on the map is a plain `newText` that scales
     * with the world and disappears at low zoom while the toolbar's geoText
     * stays legible.
     */
    const activeTextComponentType = (): 'newText' | 'geoText' =>
        toolset.hiddenTools.has('text') ? 'geoText' : 'newText'

    // One-shot text-draw mode: cursor → crosshair, next mousedown on canvas
    // places the pending text element via SCENARIO_TEXT_DRAW in newCanvas.js.
    // The explicit argument is the toolbar telling us which tool was clicked;
    // without one (the `T` hotkey) we follow the active toolset.
    const enableTextDrawMode = (
        componentType: 'newText' | 'geoText' = activeTextComponentType()
    ) => {
        togglePencilMode(false)
        togglePointer(false)
        const id = generateUUID()
        const shapeData = buildTextShapeData(id, -9999, -9999, componentType)
        if (!shapeData) return
        updateLastAddedElement(shapeData)
        setRootCursor('crosshair')
        localStorage.setItem(TEXT_DRAW_MODE_KEY, 'true')
        localStorage.setItem(LAST_ADDED_ELEMENT_ID_KEY, id)
        setTextDrawModeInBase(true)
        addToLocalComponentStore(id, componentType, shapeData)
    }

    // Place a text element at the given surface coords and immediately open
    // the editing textarea. We can't dispatch triggerTextInput on a fixed
    // timer — the NewText component is lazy-loaded, so on first use the
    // listener may not be registered for several hundred ms. Poll the Two.js
    // scene for the element instead, then dispatch once it's mounted.
    const createTextAtSurface = (x: number, y: number) => {
        const id = generateUUID()
        const componentType = activeTextComponentType()
        const shapeData = buildTextShapeData(id, x, y, componentType)
        if (!shapeData) return
        addToLocalComponentStore(id, componentType, shapeData)
        const two = twoJSInstanceRef.current
        if (!two) return
        pollUntilElement(two, id, () => {
            window.dispatchEvent(
                new CustomEvent('triggerTextInput', {
                    detail: { elementId: id },
                })
            )
        })
    }

    // Snapshots only the properties being changed before applying bulk updates
    const updateComponentBulkPropertiesInLocalStore = (
        id: string,
        bulkObj: Partial<ComponentRecord>,
        skipHistory: boolean = false,
        syncDefaults: boolean = false
    ) => {
        // Changing a property of a welcome element counts as a first real
        // interaction: promote the sketch into persisted content and spin up the
        // background base, same as the shapes toolbar. Both are one-shot.
        promoteWelcomeSketch()
        ensureBackgroundBase()

        const userId = localStorage.getItem('userId')

        if (!skipHistory) {
            // Snapshot only the properties that bulkObj will overwrite
            const currentComponent = stateRefForComponentStore.current[id]
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const prevProps: Record<string, any> = {}
            Object.keys(bulkObj).forEach((key) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let val = (currentComponent as any)?.[key]
                // Opacity has no stored value until first set, but its effective
                // prior value is "fully opaque" (or a legacy metadata.opacity).
                // Capture that so undo of the FIRST opacity change restores it
                // instead of no-op'ing on an empty snapshot.
                if (val === undefined && key === 'opacity') {
                    val = readOpacity(currentComponent)
                }
                // Same trap as opacity: the column is unset until the user
                // first turns the switch off, so without this the FIRST toggle
                // snapshots nothing and undo leaves the label stuck scaling
                // with the map. Absent means zoom-resistant — restore that.
                if (val === undefined && key === 'zoomResistant') {
                    val = true
                }
                if (val !== undefined) {
                    prevProps[key] = val
                }
            })

            recordToHistoryLog({
                action: 'UPDATE_BULK',
                id,
                prevProps,
                bulkObj,
                syncDefaults,
            })
        }

        const updatedComponentStore = { ...stateRefForComponentStore.current }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const merged: any = {
            ...updatedComponentStore[id],
            ...bulkObj,
            updatedBy: userId,
        }
        delete merged.relativeX
        delete merged.relativeY
        updatedComponentStore[id] = merged
        stateRefForComponentStore.current = updatedComponentStore
        setComponentStore(updatedComponentStore)

        if (isPersistedRef.current) {
            updateComponentInfo({
                variables: {
                    id: id,
                    updateObj: {
                        ...bulkObj,
                        updatedBy: userId,
                    },
                },
            })
        }
    }

    // Snapshots current x,y before updating position, then updates store and DB
    const updateComponentVerticesInLocalStore = (
        id: string,
        x: number,
        y: number
    ) => {
        // Dragging a welcome element counts as a first real interaction: promote
        // the sketch into persisted content and spin up the background base,
        // same as drawing via the shapes toolbar. Both are one-shot/idempotent.
        promoteWelcomeSketch()
        ensureBackgroundBase()

        const userId = localStorage.getItem('userId')

        recordToHistoryLog({
            action: 'UPDATE_VERTICES',
            id,
            prevX: stateRefForComponentStore.current[id]?.x ?? 0,
            prevY: stateRefForComponentStore.current[id]?.y ?? 0,
        })

        const updatedComponentStore = { ...stateRefForComponentStore.current }
        updatedComponentStore[id] = {
            ...updatedComponentStore[id],
            x: Math.trunc(x),
            y: Math.trunc(y),
            updatedBy: userId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any
        stateRefForComponentStore.current = updatedComponentStore
        setComponentStore(updatedComponentStore)

        if (isPersistedRef.current) {
            updateComponentInfo({
                variables: {
                    id: id,
                    updateObj: {
                        x: Math.trunc(x),
                        y: Math.trunc(y),
                        updatedBy: userId,
                    },
                },
            })
        }
    }

    // Deleting a shape must not leave connectors docked to it with dangling
    // bindings: detach every surviving arrow endpoint bound to a deleted shape
    // (keep the arrow, clear its shapeId/edge/portIndex). Applies the patches
    // (store + live elementData + DB) history-suppressed and returns one
    // UPDATE_BULK entry per detached arrow, so the caller can fold them into
    // the same BATCH as the shape DELETE — one undo restores the shape AND
    // re-docks its arrows; redo replays both. Arrows that are themselves in
    // `deletedIds` are skipped (their DELETE snapshot already carries the
    // bindings).
    const detachArrowsForDeletedShapes = (
        deletedIds: string[]
    ): HistoryEntry[] => {
        const deleted = new Set(deletedIds)
        const store = stateRefForComponentStore.current
        const entries: HistoryEntry[] = []
        Object.values(store).forEach((row) => {
            if (!row?.id || deleted.has(row.id)) return
            if (row.componentType !== 'arrowLine') return
            const patch: Partial<ComponentRecord> = {}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const prevProps: Record<string, any> = {}
            if (row.tailShapeId && deleted.has(row.tailShapeId)) {
                prevProps.tailShapeId = row.tailShapeId
                prevProps.tailEdge = row.tailEdge ?? null
                prevProps.tailPortIndex = row.tailPortIndex ?? 0
                patch.tailShapeId = null
                patch.tailEdge = null
                patch.tailPortIndex = 0
            }
            if (row.headShapeId && deleted.has(row.headShapeId)) {
                prevProps.headShapeId = row.headShapeId
                prevProps.headEdge = row.headEdge ?? null
                prevProps.headPortIndex = row.headPortIndex ?? 0
                patch.headShapeId = null
                patch.headEdge = null
                patch.headPortIndex = 0
            }
            if (Object.keys(patch).length === 0) return
            entries.push({
                action: 'UPDATE_BULK',
                id: row.id,
                prevProps,
                bulkObj: patch,
            })
            updateComponentBulkPropertiesInLocalStore(row.id, patch, true)
            // The store update doesn't touch the scene; mirror onto the live
            // arrow's elementData, which port re-anchoring reads.
            const group = twoJSInstanceRef.current?.scene?.children?.find(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (c: any) => c?.elementData?.id === row.id
            )
            if (group?.elementData) Object.assign(group.elementData, patch)
        })
        return entries
    }

    const deleteBulkComponentsFromLocalStore = (ids: string[]) => {
        ensureBackgroundBase()

        const detachEntries = detachArrowsForDeletedShapes(ids)
        const batchEntries: HistoryEntry[] = ids.map((id) => ({
            action: 'DELETE',
            id,
            prevState: {
                ...stateRefForComponentStore.current[id],
            } as ComponentRecord,
        }))
        recordBatchToHistoryLog([...detachEntries, ...batchEntries])

        const updatedComponentStore = { ...stateRefForComponentStore.current }
        ids.forEach((id) => {
            delete updatedComponentStore[id]
            window.dispatchEvent(
                new CustomEvent('elementRemoved', { detail: { id } })
            )
        })
        stateRefForComponentStore.current = updatedComponentStore
        setComponentStore(updatedComponentStore)

        if (isPersistedRef.current && ids.length > 0) {
            deleteBulkComponents({ variables: { _in: ids } })
        }
    }

    // Snapshots full component state before deletion, then removes from store and DB
    const deleteComponentFromLocalStore = (id: string) => {
        ensureBackgroundBase()

        const detachEntries = detachArrowsForDeletedShapes([id])
        const deleteEntry: HistoryEntry = {
            action: 'DELETE',
            id,
            prevState: {
                ...stateRefForComponentStore.current[id],
            } as ComponentRecord,
        }
        if (detachEntries.length > 0) {
            recordBatchToHistoryLog([...detachEntries, deleteEntry])
        } else {
            recordToHistoryLog(deleteEntry)
        }

        const updatedComponentStore = { ...stateRefForComponentStore.current }
        delete updatedComponentStore[id]
        stateRefForComponentStore.current = updatedComponentStore
        setComponentStore(updatedComponentStore)

        // Tell Canvas to untrack this id so a future restore (undo) gets a fresh wrapper
        window.dispatchEvent(
            new CustomEvent('elementRemoved', { detail: { id } })
        )

        if (isPersistedRef.current) {
            deleteComponent({
                variables: { id },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                errorPolicy: import.meta.env.VITE_GRAPHQL_ERROR_POLICY as any,
            })
        }
    }

    const setCurrentElementInBase = (val: string | null) => {
        setCurrentElement(val)
    }

    const onCreateBase = () => {
        const userId = localStorage.getItem('userId')
        createBase({
            variables: {
                object: {},
            },
        })
    }

    /**
     * The geography a share has to carry, read at the moment of sharing.
     *
     * Two different things, and both are needed:
     *
     *  - **anchor** — the georeference. Surface (0,0) IS this lng/lat at this
     *    zoom, and elements store surface pixels, so without it a recipient's
     *    map falls back to a guess made from *their* timezone and every pin
     *    lands in the wrong city.
     *  - **landing** — where the camera opens: the centre of the view being
     *    shared. Recorded as lng/lat/zoom, not tx/ty/scale, because pixel
     *    translations replayed on a different-sized screen land somewhere else.
     *
     * `readBaseTypeConfigForExport()` merges the LIVE provider's anchor, not
     * just the stored one, which is what makes this work for a map whose owner
     * never searched a place: `mapType.mount` deliberately never persists its
     * timezone guess (doing so would permanently suppress the first-visit
     * location prompt), so the only copy of that anchor is the running map's.
     */
    const captureShareGeo = (): {
        type: BaseType
        anchor: MapAnchor | null
        landing: MapAnchor | null
    } => {
        const config = readBaseTypeConfigForExport()
        const type = config.type
        const two = twoJSInstanceRef.current
        if (type !== 'map' || !two) return { type, anchor: null, landing: null }

        const anchor = config.mapAnchor ?? null
        if (!anchor) return { type, anchor: null, landing: null }

        const scene = two.scene
        const scale =
            typeof scene?.scale === 'number' && scene.scale > 0
                ? scene.scale
                : 1
        // two.width/height, never the container's clientWidth/clientHeight —
        // #main-two-root is 0-height (the SVG is absolutely positioned), which
        // would put the landing half a screen off.
        const vw = two.width || window.innerWidth
        const vh = two.height || window.innerHeight
        const centre = {
            x: (vw / 2 - scene.translation.x) / scale,
            y: (vh / 2 - scene.translation.y) / scale,
        }
        return {
            type,
            anchor,
            landing: {
                lngLat: surfaceToLngLat(centre, anchor),
                zoom: mapZoomForScale(scale, anchor),
            },
        }
    }

    /** The six geo columns for an insert/update, omitting what we don't have. */
    const shareGeoColumns = (geo: ReturnType<typeof captureShareGeo>) => ({
        ...(geo.anchor && {
            mapAnchorLng: geo.anchor.lngLat[0],
            mapAnchorLat: geo.anchor.lngLat[1],
            mapAnchorZoom: geo.anchor.zoom,
        }),
        ...(geo.landing && {
            landingLng: geo.landing.lngLat[0],
            landingLat: geo.landing.lngLat[1],
            landingZoom: geo.landing.zoom,
        }),
    })

    const persistBase = async (): Promise<string> => {
        // Stamp the base's type and geography onto the row itself. Without this
        // the row takes the 'board' default, and a shared map opens as a
        // whiteboard with every geo object hidden — which is what made maps
        // unshareable in the first place.
        const geo = captureShareGeo()

        // Always create a fresh base at share time. The background base
        // pre-created by ensureBackgroundBase may be stale (e.g. DB was reset
        // between sessions) — using its ID would cause a FK violation on insert.
        const { data: baseData } = await createBase({
            variables: {
                object: { type: geo.type, ...shareGeoColumns(geo) },
            },
        })
        const serverBaseId = baseData?.base?.id
        if (!serverBaseId) throw new Error('createBase returned no id')

        // Insert all components to DB under the server base ID.
        // Generate a fresh UUID for each component's id so re-sharing from '/'
        // never hits a "duplicate key" uniqueness violation.
        const allEntries = Object.entries(stateRefForComponentStore.current)
        const componentsForDB = allEntries
            // Skip corrupt/partial store entries (no componentType). These come
            // from undo/redo restore paths and would abort the whole bulk
            // insert with a NOT NULL violation on componentType.
            .filter(([, comp]) => (comp as ComponentRecord)?.componentType)
            // Welcome-sketch seeds are onboarding scaffolding — never share them.
            .filter(([, comp]) => !isWelcomeComponent(comp as ComponentRecord))
            .map(([, comp]) => {
                const {
                    relativeX: _rX,
                    relativeY: _rY,
                    ...cleaned
                } = stripTypename(comp)
                return {
                    ...cleaned,
                    id: generateUUID(),
                    baseId: serverBaseId,
                }
            })

        const skipped = allEntries.filter(
            ([, comp]) => !(comp as ComponentRecord)?.componentType
        )
        if (skipped.length > 0) {
            console.warn(
                '[persistBase] skipped',
                skipped.length,
                'malformed component(s) with no componentType:',
                Object.fromEntries(skipped)
            )
        }

        if (componentsForDB.length > 0) {
            await insertBulkComponents({
                variables: { objects: componentsForDB },
            })
        }

        // Mint a new local base ID so the '/' session continues independently
        // from the now-shared base. Components keep their visual state; only the
        // local identity rotates.
        const newLocalId = generateUUID()

        // Carry this session's base type, anchor and camera to the new local id.
        //
        // Both are keyed by baseId, so rotating the id without moving them
        // orphaned the lot: sharing a map and then reloading '/' brought the
        // canvas back as a *whiteboard*, with every geo object hidden and the
        // anchor gone — the user's own work invisible, on the base they had
        // just been working on. The share and the '/' session are meant to
        // diverge in identity, not in substrate.
        try {
            writeBaseTypeConfig(newLocalId, readBaseTypeConfigForExport())
            const scene = twoJSInstanceRef.current?.scene
            if (scene) {
                writeViewport(newLocalId, geo.type, isMobile, {
                    scale: typeof scene.scale === 'number' ? scene.scale : 1,
                    tx: scene.translation.x,
                    ty: scene.translation.y,
                })
            }
        } catch (_) {
            // A lost preference must never fail the share itself.
        }

        const updatedStore: ComponentStore = {}
        Object.entries(stateRefForComponentStore.current).forEach(
            ([id, comp]) => {
                updatedStore[id] = { ...comp, baseId: newLocalId }
            }
        )
        stateRefForComponentStore.current = updatedStore

        // Rotate localBaseId without wiping the Two.js scene or componentStore
        skipComponentStoreResetRef.current = true
        setLocalBaseId(newLocalId)
        setComponentStore(updatedStore)

        // Persist draft immediately under the new local ID
        try {
            localStorage.setItem(
                DRAFT_STORAGE_KEY,
                JSON.stringify({
                    baseId: newLocalId,
                    components: updatedStore,
                    timestamp: Date.now(),
                })
            )
        } catch (_) {}

        // Clear the background base (its work is now on the shared base)
        backgroundBaseIdRef.current = null
        setBackgroundBaseId(null)
        localStorage.removeItem(BACKGROUND_BASE_STORAGE_KEY)

        // Stay in local (non-persisted) mode — new drawings on '/' are a fresh session
        return serverBaseId
    }

    /**
     * Publish this base and return the id its link points at. The single entry
     * point for sharing, whichever state the base is in.
     *
     * The two paths used to diverge badly: an unpersisted base got created and
     * published, while an already-persisted one just had its URL copied — never
     * publishing it. So a base that reached `/base/:id` by any route other than
     * the share button (the storage-limit auto-persist, most reachably) had its
     * link handed out while `isPublic` stayed false.
     *
     * Re-sharing also refreshes the landing view, since the owner has almost
     * certainly panned since the base was created. It deliberately does NOT
     * touch the anchor: that is the georeference the stored elements were drawn
     * against, and rewriting it would slide the world under ink that stays put.
     */
    const shareBase = async (): Promise<string> => {
        if (!isPersistedRef.current) {
            const serverBaseId = await persistBase()
            await updateBaseVisibility({ variables: { id: serverBaseId } })
            return serverBaseId
        }

        const geo = captureShareGeo()
        await sharePersistedBase({
            variables: {
                id: baseId,
                landingLng: geo.landing?.lngLat[0] ?? null,
                landingLat: geo.landing?.lngLat[1] ?? null,
                landingZoom: geo.landing?.zoom ?? null,
            },
        })
        return baseId
    }

    // Assign storage-limit handler ref so useLocalDraftPersistence can call it
    // without a direct dependency on persistBase being defined at hook-call time.
    onStorageLimitRef.current = async () => {
        try {
            const serverBaseId = await persistBase()
            // Type-aware: a map base auto-persisted at the storage limit must
            // hand back a /map/ link, or the user follows it to a whiteboard
            // with all their geo work hidden.
            setStorageLimitBaseUrl(
                baseTypeUrl(serverBaseId, activeBaseTypeRef.current)
            )
            setShowStorageLimitModal(true)
        } catch (e) {
            console.error('Failed to auto-persist base on storage limit:', e)
        }
    }

    const clearBase = () => {
        if (isPersisted) {
            const ids = Object.keys(componentStore)
            if (ids.length > 0) {
                deleteBulkComponents({ variables: { _in: ids } })
            }
        }
        // Tear down any active selection before scene clear so the
        // selectionController doesn't hold stale group/shape refs that
        // suppress the next selection's UI.
        window.dispatchEvent(new Event('clearSelector'))
        setSelectedComponent(null)
        twoJSInstanceRef.current?.clear()
        twoJSInstanceRef.current?.update()
        setComponentStore({})
        clearHistory(isPersisted)
        // Reset element defaults to factory values so a previously-set default
        // (e.g. linewidth:0) doesn't leak into shapes drawn after clearing.
        resetDefaults()
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sel: any = selectedComponent
    const isArrowSelected =
        selectedComponent !== null &&
        (sel?.shape?.type === 'arrowLine' ||
            sel?.group?.data?.elementData?.isLineCircle === true)

    // Mirror text-property changes to a live editing textarea so the overlay
    // visually matches what Two.js will render on blur. No-op when no
    // textarea is open. fontSize is in surface units; we scale to screen
    // pixels using the current scene zoom.
    const syncOpenTextarea = ({
        fontSize,
        fontFamily,
    }: {
        fontSize?: number
        fontFamily?: string
    }) => {
        const ta = document.querySelector<HTMLElement>('.temp-input-area')
        if (!ta) return
        const sceneScale = twoJSInstance?.scene?.scale || 1
        if (typeof fontSize === 'number') {
            const cssFontSize = fontSize * sceneScale
            const lineH = Math.ceil(cssFontSize * 1.6)
            ta.style.fontSize = `${cssFontSize}px`
            ta.style.lineHeight = `${lineH}px`
        }
        if (fontFamily) {
            ta.style.fontFamily = fontFamily
        }
    }

    const handleTextSizeChange = (newLabel: string) => {
        const sizesMap = isMobile ? MOBILE_TEXT_SIZES_OBJECT : TEXT_SIZES_OBJECT
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textSize = (sizesMap as any)[newLabel]
        const twoText = sel?.shape?.data
        if (!twoText) return
        // Standalone multiline text is a stack of Two.Text line nodes (line 1
        // is `twoText`, lines 2..N are satellites in the same group). Size
        // EVERY node and re-stack the block at the new line height — sizing
        // only line 1 left the rest unchanged until a reload.
        const sizeNodes = getShapeTextNodes(sel?.group?.data)
        const nodes = sizeNodes.length > 0 ? sizeNodes : [twoText]
        const n = nodes.length
        const lineH = lineHeightFor(textSize)
        nodes.forEach((node, i) => {
            node.size = textSize
            node.leading = textSize
            node.translation.set(0, (i - (n - 1) / 2) * lineH)
        })
        const componentId = sel?.group?.data?.elementData?.id
        const existingMetadata = sel?.group?.data?.elementData?.metadata ?? {}
        const updatedMetadata = {
            ...existingMetadata,
            fontSize: textSize,
            // Reconstruct the raw multiline string from every line node,
            // not just line 1 — otherwise a reload would drop lines 2..N.
            content: nodes.map((node) => node.value).join('\n'),
        }
        // Keep the in-place elementData.metadata current too. Other property
        // handlers (e.g. opacity in applyProperty) read it as the merge base; if
        // left stale they'd write the OLD fontSize back to the store and the
        // resize would silently revert on reload.
        if (sel?.group?.data?.elementData) {
            sel.group.data.elementData.metadata = updatedMetadata
        }
        updateComponentBulkPropertiesInLocalStore(componentId, {
            metadata: updatedMetadata,
        })
        twoJSInstance?.update()
        syncOpenTextarea({ fontSize: textSize })
    }

    // After a text style change (size/family) on a shape-with-text, re-wrap the
    // text to the shape's current width at the NEW style and re-fit the shape's
    // height to the resulting line count — then persist height + metadata
    // together. This keeps the live scene and a post-reload render identical (a
    // bigger font re-wraps to more lines and the box grows vertically, instead
    // of the text spilling out; switching back reclaims that height rather than
    // leaving the box stuck at its tallest-ever size). A height the user set by
    // dragging is preserved — see `resolveHeightForTextStyleChange`. Width
    // stays user-driven either way.
    const reflowShapeTextAfterStyleChange = (
        componentId: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updatedMetadata: any,
        // Metadata as it was BEFORE this change — the style the current height
        // was fitted to, needed to tell auto-fit from a user-dragged height.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        previousMetadata: any
    ) => {
        const group = sel?.group?.data
        const shapePath = sel?.shape?.data
        const kind = group?.elementData?.componentType
        // While the inline editor is open the text layer is hidden and the
        // blur path owns the reflow+persist — don't fight it; just persist
        // the metadata so the editor reads the latest style.
        const editingActive = !!document.querySelector('.temp-input-area')
        if (editingActive || !group || !shapePath || !kind) {
            updateComponentBulkPropertiesInLocalStore(componentId, {
                metadata: updatedMetadata,
            })
            return
        }

        const rawText =
            typeof updatedMetadata.textContent === 'string'
                ? updatedMetadata.textContent
                : ''
        const width = shapePath.width
        // Re-render the wrapped multiline layer at the new style.
        applyShapeText(twoJSInstance, group, kind, width, updatedMetadata)
        const { font: nextFont } = shapeTextStyleFromMeta(updatedMetadata)
        const { font: prevFont } = shapeTextStyleFromMeta(previousMetadata)
        const newH = resolveHeightForTextStyleChange({
            kind,
            width,
            rawText,
            prevFont,
            nextFont,
            currentHeight: shapePath.height,
        })
        const heightChanged = newH !== shapePath.height
        if (heightChanged) shapePath.height = newH
        twoJSInstance?.update()
        updateComponentBulkPropertiesInLocalStore(componentId, {
            metadata: updatedMetadata,
            width: Math.round(width),
            height: Math.round(newH),
        })
        // A height change moves the n/e/s/w edge midpoints, so any connector
        // docked to this shape has to re-glue. Restacking an edge with nothing
        // docked to it is a no-op, so fire all four rather than scanning.
        if (heightChanged) {
            window.dispatchEvent(
                new CustomEvent('restackPorts', {
                    detail: {
                        ports: [
                            'n-resize',
                            'e-resize',
                            's-resize',
                            'w-resize',
                        ].map((edge) => ({ shapeId: componentId, edge })),
                    },
                })
            )
        }
    }

    const handleRectangleTextSizeChange = (newLabel: string) => {
        const sizesMap = isMobile ? MOBILE_TEXT_SIZES_OBJECT : TEXT_SIZES_OBJECT
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textSize = (sizesMap as any)[newLabel]
        const twoText = sel?.text?.data
        if (!twoText) return
        // Size every line node in the text layer (not just the first), so
        // multiline updates live — not only after a reload.
        const sizeNodes = getShapeTextNodes(sel?.group?.data)
        ;(sizeNodes.length > 0 ? sizeNodes : [twoText]).forEach(
            (n) => (n.size = textSize)
        )
        twoJSInstance?.update()

        const componentId = sel?.group?.data?.elementData?.id
        // stateRefForComponentStore is always current; group.elementData.metadata
        // is only set at mount and is stale after blur updates the store.
        const existingMetadata =
            stateRefForComponentStore.current[componentId]?.metadata ?? {}
        const updatedMetadata = { ...existingMetadata, textFontSize: textSize }
        if (sel?.group?.data?.elementData) {
            sel.group.data.elementData.metadata = updatedMetadata
        }

        reflowShapeTextAfterStyleChange(
            componentId,
            updatedMetadata,
            existingMetadata
        )
        syncOpenTextarea({ fontSize: textSize })
    }

    const handleTextFontFamilyChange = (fontFamily: string) => {
        const twoText = sel?.shape?.data
        if (!twoText) return
        // Apply to every line node (line 1 + satellites), not just line 1,
        // so multiline standalone text updates live. Family doesn't change
        // line height, so no re-stack is needed.
        const familyNodes = getShapeTextNodes(sel?.group?.data)
        const nodes = familyNodes.length > 0 ? familyNodes : [twoText]
        nodes.forEach((node) => (node.family = fontFamily))
        const componentId = sel?.group?.data?.elementData?.id
        const existingMetadata = sel?.group?.data?.elementData?.metadata ?? {}
        const updatedMetadata = {
            ...existingMetadata,
            textFontFamily: fontFamily,
            // Reconstruct the raw multiline string from every line node,
            // not just line 1 — otherwise a reload would drop lines 2..N.
            content: nodes.map((node) => node.value).join('\n'),
        }
        // Keep in-place elementData.metadata current so later handlers (opacity,
        // etc.) merge onto the new family instead of writing a stale one back.
        if (sel?.group?.data?.elementData) {
            sel.group.data.elementData.metadata = updatedMetadata
        }
        updateComponentBulkPropertiesInLocalStore(componentId, {
            metadata: updatedMetadata,
        })
        twoJSInstance?.update()
        syncOpenTextarea({ fontFamily })
        // Make selection universal: future new elements pick up this family.
        setDefaultTextFontFamily(fontFamily)
    }

    const handleRectangleTextFontFamilyChange = (fontFamily: string) => {
        const twoText = sel?.text?.data
        if (!twoText) return
        // Apply to every line node so multiline text updates live.
        const familyNodes = getShapeTextNodes(sel?.group?.data)
        ;(familyNodes.length > 0 ? familyNodes : [twoText]).forEach(
            (n) => (n.family = fontFamily)
        )
        twoJSInstance?.update()
        const componentId = sel?.group?.data?.elementData?.id
        const existingMetadata =
            stateRefForComponentStore.current[componentId]?.metadata ?? {}
        const updatedMetadata = {
            ...existingMetadata,
            textFontFamily: fontFamily,
        }
        if (sel?.group?.data?.elementData) {
            sel.group.data.elementData.metadata = updatedMetadata
        }
        // Re-wrap + re-fit height: some families (e.g. Fraunces) render wider
        // than Caveat at the same size, changing the wrap — and switching back
        // to the narrower family must give the height back.
        reflowShapeTextAfterStyleChange(
            componentId,
            updatedMetadata,
            existingMetadata
        )
        syncOpenTextarea({ fontFamily })
        // Make selection universal: future new elements pick up this family.
        setDefaultTextFontFamily(fontFamily)
    }

    const cancelPendingElement = () => {
        const pendingId = localStorage.getItem(LAST_ADDED_ELEMENT_ID_KEY)
        if (pendingId) {
            undoLastAction()
            setLastAddedElement(null)
        }
        localStorage.removeItem(LAST_ADDED_ELEMENT_ID_KEY)
        localStorage.removeItem(ARROW_DRAW_MODE_KEY)
        localStorage.removeItem(TEXT_DRAW_MODE_KEY)
        localStorage.removeItem(PENDING_SHAPE_TYPE_KEY)
        localStorage.removeItem(PENDING_SHAPE_PROPS_KEY)
        // Abort any in-progress geo draw (multi-click area/route, point place)
        // and tell the canvas to drop its preview vertices.
        localStorage.removeItem(GEO_DRAW_MODE_KEY)
        localStorage.removeItem(GEO_DRAW_TYPE_KEY)
        localStorage.removeItem(GEO_DRAW_PROPS_KEY)
        localStorage.removeItem(GEO_POINT_PLACE_MODE_KEY)
        window.dispatchEvent(new CustomEvent('cancelGeoDraw', {}))
        setIsArrowDrawMode(false)
        setIsTextDrawMode(false)
        // Detach selectionController so its hover listener stops overriding the cursor
        window.dispatchEvent(new CustomEvent('clearSelector', {}))
    }

    // Track which group (if any) is currently focused on the canvas. groupobject
    // dispatches groupFocused/groupBlurred on the window — this mirrors them
    // into React state so the sidebar can react. Independent of newCanvas.js's
    // own activeGroupRef listeners, which serve event-handler land.
    useEffect(() => {
        const onFocus = ((e: CustomEvent) => {
            const g = e?.detail?.group ?? null
            selectedGroupRef.current = g
            setSelectedGroup(g)
        }) as EventListener
        const onBlur = () => {
            selectedGroupRef.current = null
            setSelectedGroup(null)
        }
        window.addEventListener('groupFocused', onFocus)
        window.addEventListener('groupBlurred', onBlur)
        return () => {
            window.removeEventListener('groupFocused', onFocus)
            window.removeEventListener('groupBlurred', onBlur)
        }
    }, [])

    // Keep a live ref of "is anything selected" for the DOM pointer watcher
    // below — it reads this synchronously inside a capture-phase handler that
    // must not re-bind on every selection change.
    useEffect(() => {
        selectionPresentRef.current = !!selectedComponent || !!selectedGroup
    }, [selectedComponent, selectedGroup])

    // Hide the fixed properties toolbar while a selected element/group is being
    // dragged or resized, so it doesn't sit under the element mid-interaction.
    // This watches the pointer at the document level (capture phase) rather than
    // threading through the four separate drag paths (single-shape controller,
    // group object, arrow endpoints, resize handles) — any of them manifests as
    // "pointer down on the canvas with a selection, then move". Pure DOM + one
    // boolean of React state: no canvas/React races, and pointerup/cancel always
    // resets it. Drags that start on the toolbar itself (e.g. the opacity
    // slider) are excluded so adjusting a control never hides the panel.
    useEffect(() => {
        const DRAG_THRESHOLD_SQ = 4 * 4 // px², ignore click jitter
        let armed = false
        let moved = false
        let startX = 0
        let startY = 0

        const onDown = (e: PointerEvent): void => {
            if (e.button !== 0) return
            const target = e.target as HTMLElement | null
            if (!target) return
            // Ignore presses on the toolbar/UI chrome or outside the canvas, and
            // on the in-canvas text-edit field (drag-selecting text isn't an
            // element drag — the textarea is appended under #main-two-root).
            if (target.closest('#floating-toolbar')) return
            if (
                target.closest(
                    'input, textarea, [contenteditable="true"], .temp-input-area'
                )
            )
                return
            if (!target.closest('#main-two-root')) return
            // Arm only when something draggable is under (or already engaged by)
            // the pointer: a press directly on an element node, or any active
            // selection (covers resize handles, which live in the overlay group,
            // and select-then-drag). Empty-canvas presses — pan, marquee, draw —
            // are left alone so they never hide a defaults panel.
            const onElement = !!target.closest('[data-component-id]')
            if (!onElement && !selectionPresentRef.current) return
            armed = true
            moved = false
            startX = e.clientX
            startY = e.clientY
        }
        const onMove = (e: PointerEvent): void => {
            if (!armed || moved) return
            const dx = e.clientX - startX
            const dy = e.clientY - startY
            if (dx * dx + dy * dy >= DRAG_THRESHOLD_SQ) {
                moved = true
                setIsElementDragging(true)
            }
        }
        const onUp = (): void => {
            armed = false
            if (moved) {
                moved = false
                setIsElementDragging(false)
            }
        }

        document.addEventListener('pointerdown', onDown, true)
        document.addEventListener('pointermove', onMove, true)
        document.addEventListener('pointerup', onUp, true)
        document.addEventListener('pointercancel', onUp, true)
        return () => {
            document.removeEventListener('pointerdown', onDown, true)
            document.removeEventListener('pointermove', onMove, true)
            document.removeEventListener('pointerup', onUp, true)
            document.removeEventListener('pointercancel', onUp, true)
        }
    }, [])

    const applyGroupProperty = createApplyGroupProperty({
        selectedGroup,
        twoJSInstance,
        updateComponentBulkPropertiesInLocalStore,
        stateRefForComponentStore,
        recordBatchToHistoryLog,
    })

    const applyProperty = createApplyProperty({
        selectedComponent,
        twoJSInstance,
        updateComponentBulkPropertiesInLocalStore,
        updateBulkPropsForRectangleWithText: (id, obj) =>
            updateBulkPropsForRectangleWithText(id, obj),
        handleTextSizeChange: (value: unknown) =>
            handleTextSizeChange(value as string),
        handleRectangleTextSizeChange: (value: unknown) =>
            handleRectangleTextSizeChange(value as string),
        handleTextFontFamilyChange: (value: unknown) =>
            handleTextFontFamilyChange(value as string),
        handleRectangleTextFontFamilyChange: (value: unknown) =>
            handleRectangleTextFontFamilyChange(value as string),
        setDefaultFill,
        setDefaultStrokeColor,
        setDefaultLinewidth,
        setDefaultStrokeType,
        setDefaultOpacity,
        setDefaultTextColor,
        setDefaultTextSize: (value: string) =>
            setDefaultTextSize(value as never),
        setDefaultTextFontFamily,
    })

    const updateBulkPropsForRectangleWithText = (
        id: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        obj: any
    ) => {
        let finalObj = { ...obj }
        if (obj.textColor !== undefined) {
            const existingMeta =
                stateRefForComponentStore.current[id]?.metadata ?? {}
            const updatedMeta = { ...existingMeta, textFill: obj.textColor }
            finalObj.metadata = updatedMeta
            if (sel?.group?.data?.elementData) {
                sel.group.data.elementData.metadata = updatedMeta
            }
        }
        updateComponentBulkPropertiesInLocalStore(id, finalObj)
    }

    const contextValueForSidebar = {
        scaleToDisplay: props.scaleToDisplay,
        geoObjectsEnabled: props.geoObjectsEnabled,
        activeBaseType,
        baseTypeProvider,
        toolset,
        baseTypeSwitcherEnabled,
        switchBaseType,
        readBaseTypeConfig: readBaseTypeConfigForExport,
        captureBaseTypeBackdrop: captureBackdrop,
        goToPlace,
        zoomStep: baseTypeProvider.zoomStep,
        pointClusteringEnabled: props.pointClusteringEnabled,
        clusterPoints: props.clusterPoints,
        baseId,
        isPersisted,
        persistBase,
        shareBase,
        backgroundBaseId,
        isPencilMode,
        isArrowDrawMode,
        isTextDrawMode,
        isArrowSelected,
        isRubberMode,
        eraserSize,
        isPanMode,
        togglePanMode,
        setArrowDrawModeInBase,
        setTextDrawModeInBase,
        setRubberModeInBase,
        setEraserSizeInBase,
        cancelPendingElement,
        togglePencilMode,
        togglePointer,
        updateLastAddedElement,
        addToLocalComponentStore,
        enableTextDrawMode,
        createTextAtSurface,
        updateComponentVerticesInLocalStore,
        updateComponentBulkPropertiesInLocalStore,
        // Exposed so groupobject's blur path can snapshot prevProps for a
        // single batched history entry instead of one per child.
        stateRefForComponentStore,
        deleteComponentFromLocalStore,
        deleteBulkComponentsFromLocalStore,
        twoJSInstance,
        setTwoJSInstanceInBase,
        setZuiInstanceInBase,
        zuiInBase,
        selectedComponent,
        setSelectedComponentInBase,
        applyProperty,
        selectedGroup,
        applyGroupProperty,
        reorderSelected,
        fitToContent,
        componentStore,
        isElementDragging,
        // Defaults — read by ElementPropertiesToolbar, also still exposed
        // individually so legacy primary.js / Canvas reads keep working.
        defaultFill,
        defaultStrokeColor,
        defaultLinewidth,
        defaultStrokeType,
        defaultOpacity,
        defaultTextColor,
        defaultTextSize,
        defaultTextFontFamily,
        // Legacy named setters kept for primary sidebar / shape factory paths.
        setDefaultLinewidthInBase,
        setDefaultStrokeTypeInBase,
        // Mobile panel
        showMobileToolbarPanel,
        setShowMobileToolbarPanel,
        currentElement,
        setCurrentElementInBase,
        onCreateBase,
        createBaseLoading,
        historyLog,
        historyLogRef,
        bucketLog,
        bucketLogRef,
        recordBatchToHistoryLog,
        undoLastAction,
        redoLastAction,
        clearBase,
        beginBaseImport,
    }

    return (
        <>
            <BaseContext.Provider
                value={contextValueForSidebar as unknown as BaseContextValue}
            >
                <div>
                    <Sidebar />
                    {isMobile && showMultiClickDrawControls && (
                        <div
                            style={{
                                position: 'fixed',
                                bottom: '64px',
                                right: '10px',
                                zIndex: 20,
                            }}
                            className="flex flex-col gap-2"
                        >
                            <button
                                title="Finish drawing"
                                onClick={() =>
                                    window.dispatchEvent(
                                        new CustomEvent('finishGeoDraw')
                                    )
                                }
                                className="w-10 h-10 rounded-lg flex items-center justify-center bg-greens-g400 text-white shadow-md transition-colors duration-150"
                            >
                                <OkIcon className="w-5 h-5" />
                            </button>
                            <button
                                title="Cancel drawing"
                                onClick={() =>
                                    window.dispatchEvent(
                                        new CustomEvent('cancelGeoDraw')
                                    )
                                }
                                className="w-10 h-10 rounded-lg flex items-center justify-center bg-reds-r400 text-white shadow-md transition-colors duration-150"
                            >
                                <CloseIcon className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                    <MobileDeleteButton
                        drawInProgress={
                            showMultiClickDrawControls || isEditingText
                        }
                    />
                    <MobileTextControls
                        drawInProgress={showMultiClickDrawControls}
                    />
                    {!isRubberMode && isMobile && (
                        <button
                            title="Element properties"
                            onClick={() =>
                                setShowMobileToolbarPanel((prev) => !prev)
                            }
                            style={{
                                position: 'fixed',
                                bottom: '16px',
                                right: '10px',
                                zIndex: 20,
                            }}
                            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-150 ${
                                showMobileToolbarPanel
                                    ? 'bg-accent'
                                    : 'bg-accent-dark'
                            }`}
                        >
                            <img
                                src={controlsIcon}
                                className="w-5 h-5"
                                alt="Element properties"
                            />
                        </button>
                    )}
                    <ElementPropertiesToolbar />
                    <Canvas
                        pointerToggle={pointerToggle}
                        isPencilMode={isPencilMode}
                        selectPanMode={false}
                        baseId={baseId}
                        selectedComponent={selectedComponent}
                        lastAddedElement={lastAddedElement}
                        componentStore={componentStore}
                        defaultLinewidth={defaultLinewidth}
                        defaultStrokeType={defaultStrokeType}
                        defaultStrokeColor={defaultStrokeColor}
                        defaultTextSize={
                            (isMobile
                                ? MOBILE_TEXT_SIZES_OBJECT
                                : TEXT_SIZES_OBJECT)[defaultTextSize] ??
                            DEFAULT_TEXT_SIZE
                        }
                        onCameraChange={handleCameraChange}
                        renderBackground={props.renderBackground}
                        reorderSelectedRef={reorderSelectedRef}
                        fitToContentRef={fitToContentRef}
                        initialMapLanding={initialMapLanding}
                    />
                    <ClusterLayer />
                    {!isMobile && <ZoomControls />}
                    <GoToContentButton />
                    <HelpButton />
                </div>
            </BaseContext.Provider>
            {/* {isMobile ? (
                <div>
                    <div className="px-4 py-4 text-xl ">
                        The mobile version isn't here yet. Please view Craftbase
                        on your tablet or desktop (or on bigger screens) in the
                        meantime.
                    </div>
                </div>
            ) : null} */}
            <MapStartLocationModal
                open={showMapStartModal}
                fallbackCity={timezoneCity.city}
                onPick={handleMapStartPick}
                onSkip={handleMapStartSkip}
                onFallbackToTimezone={handleMapStartFallback}
            />
            <PermissionErrorModal
                open={showPermissionErrorModal}
                onClose={() => setShowPermissionErrorModal(false)}
            />
            <StorageLimitModal
                open={showStorageLimitModal}
                onClose={() => setShowStorageLimitModal(false)}
                baseUrl={storageLimitBaseUrl}
                onStartNew={handleStartNewCanvas}
                onContinue={handleContinueOnSavedBase}
            />
            <BaseFullModal
                open={showBaseFullModal}
                onClose={() => setShowBaseFullModal(false)}
                onExport={handleExportBaseFromModal}
            />
            <BaseTooLargeModal
                open={showBaseTooLargeModal}
                onDownloadBackup={handleDownloadBaseBackup}
                onStartFresh={handleStartFreshFromTooLarge}
                onOpenAnyway={handleOpenBaseAnyway}
            />
            <ImportBaseModal
                open={showImportChooser}
                onClose={handleImportChooserClose}
                error={importError}
                total={pendingImportRef.current?.total}
                skipped={pendingImportRef.current?.skipped}
                onOpenAsNew={handleImportOpenAsNew}
                onMerge={handleImportMerge}
            />
            <Toast
                open={showPerfWarning}
                onClose={dismissPerfWarning}
                message={`This canvas has over ${PERFORMANCE_WARNING_THRESHOLD.toLocaleString()} elements — panning, zooming and editing may feel slow.`}
            />
            {/* {!isPersisted && draftSizeBytes > 0 && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: 5,
                        right: 12,
                        zIndex: 10,
                    }}
                    className="text-xs text-ink-mid bg-card-bg border border-border-panel rounded px-2 py-1 select-none pointer-events-none"
                    title="Local draft size (UTF-8)"
                >
                    Draft {formatDraftBytes(draftSizeBytes)}
                </div>
            )} */}
        </>
    )
}

export default BaseViewPage
