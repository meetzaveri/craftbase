// Turning a wheel event into a zoom step for `ZUI.zoomBy`.
//
// `zoomBy` takes a delta in log space (`scale *= e^step`), so the job here is
// to get from an event whose units differ per browser and per input device to
// one number that feels the same everywhere.
//
// `wheelDeltaY` is preferred wherever it exists, because that is what shipped
// and the feel on Chrome and Safari should not move. It is NOT a fixed multiple
// of `deltaY`: a discrete mouse notch reports 120 against a `deltaY` of 100,
// while a trackpad reports 3x. Deriving one from the other would change the
// feel of one device to fix the other.
//
// Firefox never sets `wheelDeltaY` and reports LINE units, so a notch there
// works out to a ~0.3% zoom. That was survivable while zoom was a modifier
// gesture on the whiteboard. It is not survivable on the map base, where the
// bare wheel is the primary zoom control.

/** Chosen so a Firefox notch (3 lines) lands on Chrome's 100px notch. */
const WHEEL_LINE_HEIGHT_PX = 33
const WHEEL_PAGE_HEIGHT_PX = 400

/**
 * Ceiling on a single event's zoom step.
 *
 * macOS trackpads keep emitting inertial wheel events after the fingers lift,
 * and the first of those can carry a very large delta. Without a clamp one hard
 * flick crosses several zoom levels in a single frame, which on a map reads as
 * the camera teleporting rather than zooming.
 */
const MAX_WHEEL_ZOOM_STEP = 0.5

/** A wheel event as a log-space zoom step, positive to zoom in. */
export function wheelZoomStep(e: WheelEvent): number {
    const legacy = (e as WheelEvent & { wheelDeltaY?: number }).wheelDeltaY

    let step: number
    if (typeof legacy === 'number' && legacy !== 0) {
        step = legacy / 1000
    } else {
        let dy = e.deltaY
        if (e.deltaMode === 1) dy *= WHEEL_LINE_HEIGHT_PX
        else if (e.deltaMode === 2) dy *= WHEEL_PAGE_HEIGHT_PX
        // 1.2 rebuilds the 120-per-100px ratio the legacy field carries.
        step = (-dy * 1.2) / 1000
    }

    return Math.max(-MAX_WHEEL_ZOOM_STEP, Math.min(MAX_WHEEL_ZOOM_STEP, step))
}
