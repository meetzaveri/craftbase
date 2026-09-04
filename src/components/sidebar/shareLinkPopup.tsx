import { useRef, useState, useEffect } from 'react'
import type { ReactElement } from 'react'
import { useMutation } from '@apollo/client'

import Button from '../common/button'
import Modal from '../common/modal'
import ShareIcon from '../../assets/share-android.svg?react'
import CopyIcon from '../../assets/copy.svg'
import { useBoardContext } from '../../views/Board/boardContext'
import { UPDATE_BOARD_VISIBILITY } from '../../schema/mutations'

const ShareLinkPopup = (): ReactElement => {
    const refNode = useRef<HTMLDivElement | null>(null)
    const [showLink, setShowLink] = useState(false)
    const [showConfirmModal, setShowConfirmModal] = useState(false)
    const [isPersisting, setIsPersisting] = useState(false)
    const [shareUrl, setShareUrl] = useState<string | null>(null)
    const {
        isPersisted,
        persistBoard,
        backgroundBoardId,
        stateRefForComponentStore,
        twoJSInstance,
    } = useBoardContext()

    // Whether there's anything to share. Gate on the actual component store,
    // NOT backgroundBoardId: that id is only minted by ensureBackgroundBoard()
    // on a user *mutation*, so a draft restored from localStorage renders
    // components on the board while backgroundBoardId is still null — which
    // wrongly showed "Nothing to share yet" until the user touched the board.
    // Mirror persistBoard's filter (entries without componentType are skipped
    // there) so the two stay consistent.
    const hasComponents = Object.values(stateRefForComponentStore.current).some(
        (c) => c?.componentType
    )
    const [updateBoardVisibility] = useMutation(UPDATE_BOARD_VISIBILITY)

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

    const handleShareClick = (e: React.MouseEvent): void => {
        e.preventDefault()
        if (!isPersisted) {
            setShowConfirmModal(true)
        } else {
            setShareUrl(window.location.href)
            setShowLink(!showLink)
        }
    }

    const handleConfirmShare = async (): Promise<void> => {
        setIsPersisting(true)
        try {
            const serverBoardId = await persistBoard()
            await updateBoardVisibility({ variables: { id: serverBoardId } })
            const url = `${window.location.origin}/board/${serverBoardId}`
            // The shared/copied link stays clean (no params) — params only ride
            // on the auto-opened tab to hand off the current '/' viewport.
            setShareUrl(url)
            setShowConfirmModal(false)
            setShowLink(true)
            // Carry the live '/' viewport (pan + zoom) to the freshly-created
            // board via query params so the opened tab lands on the same view
            // instead of the origin. Read the live scene rather than the
            // debounced localStorage entry so the last pan before clicking Share
            // is included. The land side (newCanvas) consumes these once, seeds
            // this board's viewport localStorage key(s), then strips the params.
            const scene = twoJSInstance?.scene
            const openUrl = scene
                ? `${url}?vx=${scene.translation.x}&vy=${scene.translation.y}&vs=${scene.scale}`
                : url
            window.open(openUrl, '_blank', 'noopener,noreferrer')
        } finally {
            setIsPersisting(false)
        }
    }

    const previewUrl = backgroundBoardId
        ? `${window.location.origin}/board/${backgroundBoardId}`
        : `${window.location.origin}/board/...`

    return (
        <>
            <div className="relative " ref={refNode} style={{ right: '-9px' }}>
                <div
                    className="px-1 py-1 border-border-panel border  flex items-center justify-center rounded-md bg-card-bg text-ink font-semibold cursor-pointer "
                    onClick={handleShareClick}
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
                        style={{ width: '560px' }}
                    >
                        <div className="text-base text-left">
                            Board Link (Public)
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
                <div style={{ minWidth: '440px', maxWidth: '520px' }}>
                    {hasComponents ? (
                        <>
                            <h2 className="text-lg font-semibold mb-3 font-display">
                                Share this board
                            </h2>
                            <p className="text-sm text-ink-mid mb-2">
                                We'll generate a unique board link so you can
                                share your work with others.
                            </p>
                            <p className="text-sm text-ink-mid mb-4">
                                This board will be visible to anyone you share
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
                                board to make it shareable.
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
