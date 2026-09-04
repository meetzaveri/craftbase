import type { ReactElement } from 'react'
import Modal from '../common/modal'
import ToggleSwitch from '../common/toggleSwitch'
import { useConnectorsEnabled } from '../../hooks/useConnectorsEnabled'
import { useDotGridEnabled } from '../../hooks/useDotGridEnabled'

interface SettingsModalProps {
    open: boolean
    onClose: () => void
}

const SettingsModal = ({ open, onClose }: SettingsModalProps): ReactElement => {
    const [connectorsEnabled, setConnectorsEnabled] = useConnectorsEnabled()
    const [dotGridEnabled, setDotGridEnabled] = useDotGridEnabled()

    return (
        <Modal open={open} onClose={onClose}>
            <div style={{ minWidth: '360px', maxWidth: '460px' }}>
                <h2 className="text-lg font-semibold mb-4 font-display">
                    Settings
                </h2>

                <div className="flex items-start justify-between gap-4">
                    <label
                        htmlFor="connectors-toggle"
                        className="flex-1 cursor-pointer"
                    >
                        <span className="block text-sm font-medium text-ink-mid">
                            Connectors
                        </span>
                        <span className="mt-0.5 block text-xs text-ink-muted">
                            Show connection ports on shapes and let arrows snap
                            to them, so connectors stay attached when you move or
                            resize a shape.
                        </span>
                    </label>

                    <ToggleSwitch
                        id="connectors-toggle"
                        label="Connectors"
                        checked={connectorsEnabled}
                        onChange={setConnectorsEnabled}
                    />
                </div>

                <div className="mt-4 flex items-start justify-between gap-4">
                    <label
                        htmlFor="dot-grid-toggle"
                        className="flex-1 cursor-pointer"
                    >
                        <span className="block text-sm font-medium text-ink-mid">
                            Dot grid background
                        </span>
                        <span className="mt-0.5 block text-xs text-ink-muted">
                            Show the parchment dot grid behind the canvas. It
                            scales and pans with the zoom.
                        </span>
                    </label>

                    <ToggleSwitch
                        id="dot-grid-toggle"
                        label="Dot grid background"
                        checked={dotGridEnabled}
                        onChange={setDotGridEnabled}
                    />
                </div>
            </div>
        </Modal>
    )
}

export default SettingsModal
