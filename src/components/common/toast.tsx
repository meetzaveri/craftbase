import { useEffect, useState } from 'react'

interface ToastProps {
    /** When true the toast is shown and the auto-dismiss timer starts. */
    open: boolean
    message: string
    /** Auto-dismiss delay in ms. */
    duration?: number
    onClose: () => void
}

const FADE_MS = 200

/**
 * Small transient notice pinned to the bottom of the canvas. Non-interactive
 * and self-dismissing — it must never sit in the way of the board, so it stays
 * `pointer-events-none` and fades itself out.
 */
const Toast: React.FC<ToastProps> = ({
    open,
    message,
    duration = 15000,
    onClose,
}) => {
    // Drives the fade: flipped on a tick after mount so the transition runs.
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        if (!open) {
            setVisible(false)
            return
        }

        const fadeIn = requestAnimationFrame(() => setVisible(true))
        // Fade out first, then unmount via onClose so the exit is visible.
        const fadeOutTimer = setTimeout(
            () => setVisible(false),
            Math.max(duration - FADE_MS, 0)
        )
        const closeTimer = setTimeout(onClose, duration)

        return (): void => {
            cancelAnimationFrame(fadeIn)
            clearTimeout(fadeOutTimer)
            clearTimeout(closeTimer)
        }
    }, [open, duration, onClose])

    if (!open) return null

    return (
        <div
            role="status"
            aria-live="polite"
            style={{
                position: 'fixed',
                bottom: 24,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 50,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                opacity: visible ? 1 : 0,
                transition: `opacity ${FADE_MS}ms ease-in-out`,
            }}
            className="max-w-[90vw] rounded-md px-3 py-2 text-xs text-white select-none pointer-events-none"
        >
            {message}
        </div>
    )
}

export default Toast
