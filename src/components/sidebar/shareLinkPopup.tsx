import { useRef, useState, useEffect } from 'react'
import type { ReactElement } from 'react'
import Button from '../common/button'
import Modal from '../common/modal'
import ShareIcon from '../../assets/share-android.svg?react'
import CopyIcon from '../../assets/copy.svg'
import { useBaseContext } from '../../views/Base/baseContext'
import { useMediaQueryUtils } from '../../constants/exportHooks'
import { baseTypeUrl } from '../../utils/baseRoutes'
import { SHARE_BUTTON_ID } from './shapesToolbarId'

const ShareLinkPopup = (): ReactElement => {
    const refNode = useRef<HTMLDivElement | null>(null)
    const [showLink, setShowLink] = useState(false)
    const [showConfirmModal, setShowConfirmModal] = useState(false)
    const [isPersisting, setIsPersisting] = useState(false)
    const [shareUrl, setShareUrl] = useState<string | null>(null)
    const {
        isPersisted,
        shareBase,
        baseId,
        activeBaseType,
        baseTypeProvider,
        stateRefForComponentStore,
        twoJSInstance,
    } = useBaseContext()
    const { isMobile } = useMediaQueryUtils()

    // Sharing a map before its provider has mounted would record the WRONG
    // geography, permanently. The anchor is read from the live provider, so
    // until the (~1MB, dynamically imported) maplibre chunk lands there is
    // nothing to read and the base would be georeferenced to a timezone guess
    // instead of the place the user is looking at. One boolean; the whole
    // feature's worst failure mode.
    const baseTypeReady =
        activeBaseType !== 'map' || baseTypeProvider?.id === 'map'

    // Whether there's anything to share. Gate on the actual component store,
    // NOT backgroundBaseId: that id is only minted by ensureBackgroundBase()
    // on a user *mutation*, so a draft restored from localStorage renders
    // components on the base while backgroundBaseId is still null — which
    // wrongly showed "Nothing to share yet" until the user touched the canvas.
    // Mirror persistBase's filter (entries without componentType are skipped
    // there) so the two stay consistent.
    const hasComponents = Object.values(stateRefForComponentStore.current).some(
        (c) => c?.componentType
    )

    useEffect(() => {
        const handleClick = (e: MouseEvent): void => {
            if (refNode.current?.contains(e.target as Node)) return
            setShowLink(false)
        }
        document.addEventListener('mousedown', handleClick, false)
        return (): void => {
            document.removeEventListener('mousedown', handleClick, false)
        }
    }, [])

    // Always route through the confirm modal, including for an already-persisted
    // base. The old short-circuit just copied the URL and never published, so a
    // base that reached its URL by any path other than this button (the
    // storage-limit auto-persist, most reachably) had its link handed out while
    // it was still private.
    const handleShareClick = (e: React.MouseEvent): void => {
        e.preventDefault()
        if (showLink) {
            setShowLink(false)
            return
        }
        setShowConfirmModal(true)
    }

    const handleConfirmShare = async (): Promise<void> => {
        setIsPersisting(true)
        try {
            const wasPersisted = isPersisted
            const serverBaseId = await shareBase()
            const url = baseTypeUrl(serverBaseId, activeBaseType)
            setShareUrl(url)
            setShowConfirmModal(false)
            setShowLink(true)

            // Already on this base — there is nothing to open.
            if (wasPersisted) return

            // A map base carries its landing view in the base row, which is
            // device-independent and survives a copied link; the vx/vy/vs params
            // are neither, and would only race the better mechanism and win.
            // They stay for board bases, which have no row-level landing view.
            const scene = twoJSInstance?.scene
            const openUrl =
                scene && activeBaseType !== 'map'
                    ? `${url}?vx=${scene.translation.x}&vy=${scene.translation.y}&vs=${scene.scale}`
                    : url

            // Mobile browsers block window.open after an await (the click's task
            // chain is long gone), so the user would get a link panel and no tab
            // — or nothing at all. Hand them the OS share sheet instead, which
            // is the affordance they expect on a phone anyway.
            if (isMobile) {
                void navigator
                    ?.share?.({ url })
                    // Dismissing the sheet rejects; the link panel is already
                    // open behind it, so there is nothing to recover from.
                    .catch(() => {})
                return
            }
            window.open(openUrl, '_blank', 'noopener,noreferrer')
        } finally {
            setIsPersisting(false)
        }
    }

    // What the user is about to get. For a persisted base that is exactly the
    // link; for a new one the id doesn't exist yet, so show the shape of it
    // rather than a different base's id — this used to preview
    // `backgroundBaseId`, which persistBase never uses, so the URL previewed
    // was never the URL produced.
    const previewUrl = isPersisted
        ? baseTypeUrl(baseId, activeBaseType)
        : `${baseTypeUrl('', activeBaseType)}...`

    return (
        <>
            <div className="relative " ref={refNode} style={{ right: '-9px' }}>
                <div
                    id={SHARE_BUTTON_ID}
                    className="px-1 py-1 border-border-panel border  flex items-center justify-center rounded-md bg-card-bg text-ink font-semibold"
                    style={{
                        cursor: baseTypeReady ? 'pointer' : 'progress',
                        opacity: baseTypeReady ? 1 : 0.6,
                    }}
                    title={
                        baseTypeReady ? 'Share' : 'Preparing the map\u2026'
                    }
                    onClick={baseTypeReady ? handleShareClick : undefined}
                >
                    {/* <div className="pr-2 text-white">Share</div>{' '} */}
                    <div className="px-2 py-2 hover:bg-accent/50 rounded-md">
                        <ShareIcon
                            width={20}
                            height={20}
                            strokeWidth={1.5}
                            stroke="currentColor"
                        />
                    </div>
                </div>

                <div
                    className="absolute top-12 right-0 transition-all ease-in duration-200"
                    style={{
                        opacity: showLink ? 1 : 0,
                        zIndex: showLink ? 1 : -1,
                    }}
                >
                    <div
                        className="
                        bg-card-bg text-ink-mid border border-border-panel
                        rounded-md px-2 py-4
                        "
                        // Never wider than the screen: 560px overflows every
                        // phone, and the panel is right-anchored so the overflow
                        // lands off-screen where the link can't be read or copied.
                        style={{ width: 'min(560px, calc(100vw - 24px))' }}
                    >
                        <div className="text-base text-left">
                            Canvas Link (Public)
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                            <div className="text-sm rounded-md bg-sidebar border border-border-card text-ink px-2 py-2 select-text cursor-text break-all">
                                {shareUrl}
                            </div>
                            <div
                                className="ml-2 rounded-md
                                px-2 py-2 cursor-pointer bg-sidebar border border-border-card
                                hover:bg-border-panel
                                "
                                onClick={(e): void => {
                                    e.stopPropagation()
                                    if (shareUrl) {
                                        navigator?.clipboard?.writeText(
                                            shareUrl
                                        )
                                    }
                                    setShowLink(false)
                                }}
                            >
                                <img
                                    src={CopyIcon}
                                    className="w-5 h-5 "
                                    alt="Copy"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Modal
                open={showConfirmModal}
                onClose={(): void => {
                    if (!isPersisting) setShowConfirmModal(false)
                }}
                locked={isPersisting}
            >
                <div
                    style={{
                        minWidth: 'min(440px, calc(100vw - 96px))',
                        maxWidth: '520px',
                    }}
                >
                    {hasComponents ? (
                        <>
                            <h2 className="text-lg font-semibold mb-3 font-display">
                                Share this canvas
                            </h2>
                            <p className="text-sm text-ink-mid mb-2">
                                We'll generate a unique canvas link so you can
                                share your work with others.
                            </p>
                            <p className="text-sm text-ink-mid mb-4">
                                This canvas will be visible to anyone you share
                                the link with. Your shareable URL will be:
                            </p>
                            <div className="text-sm rounded-md bg-sidebar border border-border-card text-ink px-3 py-2 mb-4 break-all">
                                {previewUrl}
                            </div>
                            <p className="text-sm text-ink-mid mb-4">
                                Would you like to proceed?
                            </p>
                            <div className="flex gap-2 justify-end">
                                <Button
                                    intent="secondary"
                                    size="medium"
                                    label="Cancel"
                                    onClick={(): void =>
                                        setShowConfirmModal(false)
                                    }
                                    disabled={isPersisting}
                                />
                                <Button
                                    intent="primary"
                                    size="medium"
                                    label="Yes, share"
                                    onClick={handleConfirmShare}
                                    loading={isPersisting}
                                    disabled={isPersisting}
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <h2 className="text-lg font-semibold mb-3 font-display">
                                Nothing to share yet
                            </h2>
                            <p className="text-sm text-ink-mid mb-4">
                                Before you share, please create something on the
                                canvas to make it shareable.
                            </p>
                            <div className="flex justify-end">
                                <Button
                                    intent="primary"
                                    size="medium"
                                    label="Okay"
                                    onClick={(): void =>
                                        setShowConfirmModal(false)
                                    }
                                />
                            </div>
                        </>
                    )}
                </div>
            </Modal>
        </>
    )
}

export default ShareLinkPopup
