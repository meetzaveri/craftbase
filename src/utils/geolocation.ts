// One-shot "where am I" lookup for the map base's start-location prompt.
//
// Geolocation was deliberately removed from this app once before, for three
// reasons recorded in `mapType.ts`: it prompted the user unbidden the instant
// they switched base, it never fired at all on some mobile browsers, and
// everyone who declined was left on a hard-coded city. It is back only because
// all three are now answered:
//
//   unbidden  — this is never called on mount. It runs from an explicit tap on
//               "Use my current location", so the browser's own permission
//               sheet arrives with context the user just asked for.
//   silent    — `getCurrentPosition` on some mobile browsers invokes NEITHER
//               callback. The spec's own `timeout` option is not enough there,
//               because that timer is part of the same call that never runs, so
//               this wraps it in an independent `setTimeout` backstop and
//               settles on whichever fires first.
//   dead end  — every failure is a typed reason the caller can explain and
//               recover from, not a silent no-op. The map base always has the
//               timezone city to fall back to.

import { DEFAULT_ANCHOR_ZOOM } from './timezoneCities'
import type { MapAnchor } from '../baseTypes/types'

/**
 * Why a lookup produced no coordinate. Kept coarse on purpose — the UI says
 * something different for "you said no" than for "your browser couldn't", and
 * nothing finer than that is worth surfacing to a person.
 */
export type GeolocationFailure =
    /** PERMISSION_DENIED, or a non-secure origin where the API is blocked. */
    | 'denied'
    /** No API, position unavailable, or an error the spec doesn't enumerate. */
    | 'unavailable'
    /** Neither callback arrived before the backstop fired. */
    | 'timeout'

export type GeolocationOutcome =
    | { ok: true; anchor: MapAnchor }
    | { ok: false; reason: GeolocationFailure }

/**
 * Backstop timeout. Generous enough for a cold GPS fix on a phone, short enough
 * that a browser which never answers doesn't leave a spinner up indefinitely.
 */
const LOOKUP_TIMEOUT_MS = 12000

/**
 * Ask the browser for the user's position, resolved as a map anchor.
 *
 * Never rejects and never throws: every path resolves to an outcome, because a
 * failed lookup is an ordinary answer here, not an exception. Resolves at most
 * once even if a late callback arrives after the backstop.
 */
export function requestCurrentLocation(): Promise<GeolocationOutcome> {
    return new Promise<GeolocationOutcome>((resolve) => {
        // `navigator.geolocation` exists but is inert on insecure origins, and
        // browsers differ on whether they reject or hang. Checking up front
        // turns "mysteriously stuck" into an immediate, explainable answer —
        // which is what LAN-IP mobile testing over plain http:// hits.
        const secure =
            typeof window === 'undefined' ||
            window.isSecureContext !== false
        if (!('geolocation' in navigator) || !secure) {
            resolve({ ok: false, reason: secure ? 'unavailable' : 'denied' })
            return
        }

        let settled = false
        const settle = (outcome: GeolocationOutcome): void => {
            if (settled) return
            settled = true
            clearTimeout(backstop)
            resolve(outcome)
        }

        const backstop = setTimeout(
            () => settle({ ok: false, reason: 'timeout' }),
            LOOKUP_TIMEOUT_MS
        )

        try {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { longitude, latitude } = position.coords
                    if (
                        !Number.isFinite(longitude) ||
                        !Number.isFinite(latitude)
                    ) {
                        settle({ ok: false, reason: 'unavailable' })
                        return
                    }
                    settle({
                        ok: true,
                        anchor: {
                            lngLat: [longitude, latitude],
                            // A GPS fix is at least as precise as the timezone
                            // city guess it replaces, so it earns the same
                            // street-level zoom every other start path uses.
                            zoom: DEFAULT_ANCHOR_ZOOM,
                        },
                    })
                },
                (error) => {
                    settle({
                        ok: false,
                        reason:
                            error?.code === 1 /* PERMISSION_DENIED */
                                ? 'denied'
                                : error?.code === 3 /* TIMEOUT */
                                  ? 'timeout'
                                  : 'unavailable',
                    })
                },
                {
                    enableHighAccuracy: false,
                    timeout: LOOKUP_TIMEOUT_MS,
                    // A recent fix is fine — this only picks a starting view.
                    maximumAge: 5 * 60 * 1000,
                }
            )
        } catch (_) {
            // Some engines throw synchronously on a blocked origin.
            settle({ ok: false, reason: 'unavailable' })
        }
    })
}
