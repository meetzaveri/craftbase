import type { ReactElement } from 'react'
import Modal from '../common/modal'
import Button from '../common/button'

interface StorageLimitModalProps {
    open: boolean
    onClose: () => void
    baseUrl?: string | null
    onStartNew: () => void
    onContinue: () => void
}

export default function StorageLimitModal({
    open,
    onClose,
    baseUrl,
    onStartNew,
    onContinue,
}: StorageLimitModalProps): ReactElement {
    return (
        <Modal open={open} onClose={onClose} locked={false}>
            <div className="p-4" style={{ minWidth: 'min(400px, calc(100vw - 96px))' }}>
                <h2 className="text-lg font-semibold mb-2">
                    Storage Limit Reached
                </h2>
                <p className="text-sm text-neutrals-n700 mb-4">
                    Your local storage is full. Your current work has been
                    saved to the server.
                </p>
                {baseUrl && (
                    <p className="text-sm text-neutrals-n700 mb-4 break-all">
                        Saved canvas URL:{' '}
                        <a
                            href={baseUrl}
                            className="text-accent-dark underline"
                        >
                            {baseUrl}
                        </a>
                    </p>
                )}
                <div className="flex gap-2">
                    <Button
                        intent="primary"
                        size="medium"
                        label="Start New Canvas"
                        onClick={onStartNew}
                    />
                    <Button
                        intent="secondary"
                        size="medium"
                        label="Continue on Saved Canvas"
                        onClick={onContinue}
                    />
                </div>
            </div>
        </Modal>
    )
}
