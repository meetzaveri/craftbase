import type { ReactElement } from 'react'
import Modal from '../common/modal'
import Button from '../common/button'
import {
    MAX_DRAFT_BYTES,
    MAX_DRAFT_UTF8_BYTES,
} from '../../utils/boardSizeGuard'

// Load-side ceiling is a UTF-16 storage-footprint estimate; the write-side
// budget is a real UTF-8 size (what the live readout shows).
const loadBudgetMb = Math.round(MAX_DRAFT_BYTES / (1024 * 1024))
const writeBudgetMb = Math.round(MAX_DRAFT_UTF8_BYTES / (1024 * 1024))

interface BoardFullModalProps {
    open: boolean
    onClose: () => void
    onExport: () => void
}

/**
 * Write-side notice: a paste/draw was rolled back because it would have pushed
 * the board past the size budget. Non-destructive — the revert already ran, so
 * this just explains it and offers an export as the way to keep growing.
 */
export function BoardFullModal({
    open,
    onClose,
    onExport,
}: BoardFullModalProps): ReactElement {
    return (
        <Modal open={open} onClose={onClose} locked={false}>
            <div className="p-4" style={{ minWidth: '400px' }}>
                <h2 className="text-lg font-semibold mb-2">Board is full</h2>
                <p className="text-sm text-neutrals-n700 mb-4">
                    This board reached the ~{writeBudgetMb} MB size limit, so your
                    last change was undone to keep it stable and loadable.
                    Export the board to a file if you want to keep building on
                    it elsewhere.
                </p>
                <div className="flex gap-2">
                    <Button
                        intent="primary"
                        size="medium"
                        label="Export as JSON"
                        onClick={onExport}
                    />
                    <Button
                        intent="secondary"
                        size="medium"
                        label="Got it"
                        onClick={onClose}
                    />
                </div>
            </div>
        </Modal>
    )
}

interface BoardTooLargeModalProps {
    open: boolean
    onDownloadBackup: () => void
    onStartFresh: () => void
    onOpenAnyway: () => void
}

/**
 * Load-side rescue: the persisted draft is too large to render without
 * freezing. Shown INSTEAD of loading it. "Download backup" reads the raw draft
 * straight from localStorage (no rendering), so it works even though the board
 * can't be opened normally. `locked` so it can't be dismissed into a frozen
 * canvas — the user must pick a recovery path.
 */
export function BoardTooLargeModal({
    open,
    onDownloadBackup,
    onStartFresh,
    onOpenAnyway,
}: BoardTooLargeModalProps): ReactElement {
    return (
        <Modal open={open} onClose={() => {}} locked>
            <div className="p-4" style={{ minWidth: '400px' }}>
                <h2 className="text-lg font-semibold mb-2">
                    This board is too large to open
                </h2>
                <p className="text-sm text-neutrals-n700 mb-4">
                    It exceeds the ~{loadBudgetMb} MB limit and opening it may
                    freeze the page. Download a backup of your work first, then
                    start with a fresh canvas.
                </p>
                <div className="flex gap-2">
                    <Button
                        intent="primary"
                        size="medium"
                        label="Download backup"
                        onClick={onDownloadBackup}
                    />
                    <Button
                        intent="secondary"
                        size="medium"
                        label="Start fresh"
                        onClick={onStartFresh}
                    />
                </div>
                <button
                    className="mt-3 text-xs text-neutrals-n700 underline hover:text-ink"
                    onClick={onOpenAnyway}
                >
                    Open anyway (may freeze)
                </button>
            </div>
        </Modal>
    )
}
