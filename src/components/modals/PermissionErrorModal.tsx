import type { ReactElement } from 'react'
import Modal from '../common/modal'
import Button from '../common/button'

interface PermissionErrorModalProps {
    open: boolean
    onClose: () => void
}

export default function PermissionErrorModal({
    open,
    onClose,
}: PermissionErrorModalProps): ReactElement {
    return (
        <Modal open={open} onClose={onClose} locked={false}>
            <div className="p-4" style={{ minWidth: '400px' }}>
                <h2 className="text-lg font-semibold mb-2">Permission Denied</h2>
                <p className="text-sm text-neutrals-n700 mb-4">
                    You don't have permission to add components to this board.
                    If you already have access, please refresh the page and try
                    again.
                </p>
                <div className="flex gap-2">
                    <Button
                        intent="primary"
                        size="medium"
                        label="Refresh"
                        onClick={(): void => window.location.reload()}
                    />
                    <Button
                        intent="secondary"
                        size="medium"
                        label="Dismiss"
                        onClick={onClose}
                    />
                </div>
            </div>
        </Modal>
    )
}
