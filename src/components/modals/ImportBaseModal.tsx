import type { ReactElement } from 'react'
import Modal from '../common/modal'
import Button from '../common/button'

interface ImportBaseModalProps {
    open: boolean
    onClose: () => void
    /** When set, the modal shows an error state instead of the chooser. */
    error?: string | null
    total?: number
    skipped?: number
    onOpenAsNew?: () => void
    onMerge?: () => void
}

/**
 * Post-file-pick chooser for importing a canvas. On success it asks how to
 * apply the file — replace the canvas or merge into it. On a hard failure
 * (bad JSON / not a craftbase export / nothing valid) it surfaces the error with a single
 * dismiss.
 */
export default function ImportBaseModal({
    open,
    onClose,
    error,
    total = 0,
    skipped = 0,
    onOpenAsNew,
    onMerge,
}: ImportBaseModalProps): ReactElement {
    const valid = total - skipped

    return (
        <Modal open={open} onClose={onClose} locked={false}>
            <div className="p-4" style={{ minWidth: 'min(400px, calc(100vw - 96px))' }}>
                {error ? (
                    <>
                        <h2 className="text-lg font-semibold mb-2">
                            Couldn’t import canvas
                        </h2>
                        <p className="text-sm text-neutrals-n700 mb-4">
                            {error}
                        </p>
                        <div className="flex gap-2">
                            <Button
                                intent="primary"
                                size="medium"
                                label="Close"
                                onClick={onClose}
                            />
                        </div>
                    </>
                ) : (
                    <>
                        <h2 className="text-lg font-semibold mb-2">
                            Import canvas
                        </h2>
                        <p className="text-sm text-neutrals-n700 mb-1">
                            Found {valid} element{valid === 1 ? '' : 's'} in
                            this file.
                        </p>
                        {skipped > 0 && (
                            <p className="text-xs text-neutrals-n700 mb-3">
                                {skipped} unreadable item
                                {skipped === 1 ? '' : 's'} will be skipped.
                            </p>
                        )}
                        <p className="text-sm text-neutrals-n700 mb-4">
                            Open it as a new canvas (replaces your current
                            canvas) or merge it into what you have now?
                        </p>
                        <div className="flex gap-2">
                            <Button
                                intent="primary"
                                size="medium"
                                label="Open as new canvas"
                                onClick={onOpenAsNew}
                            />
                            <Button
                                intent="secondary"
                                size="medium"
                                label="Merge into current"
                                onClick={onMerge}
                            />
                        </div>
                    </>
                )}
            </div>
        </Modal>
    )
}
