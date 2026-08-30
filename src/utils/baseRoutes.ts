// Which URL a base lives at, in one place.
//
// A base has two possible paths — `/base/:id` for a whiteboard and `/map/:id`
// for a map — and several unrelated bits of the app need to ask "is this a
// base opened from a URL?" or "what link do I hand the user?". Those questions
// were answered by hard-coded `'/base/'` string tests scattered across the
// canvas and the toolbar, which all silently answered "no" the moment the map
// route existed. Answer them here instead.

import { DEFAULT_BASE_TYPE } from '../baseTypes/types'
import type { BaseType } from '../baseTypes/types'

/** URL segment each base type is served under. */
const PATH_FOR_BASE_TYPE: Record<BaseType, string> = {
    board: '/base/',
    map: '/map/',
}

/**
 * Is this path a base loaded from a URL, rather than the local draft at `/`?
 *
 * Gates the two "the camera may be pointing at nothing — rescue it" features
 * (auto-fit-on-load and the Go-to-content pill). Both are for bases that
 * arrived with someone else's camera; `/` lands on deliberately-placed content
 * and needs no rescue.
 */
export function isUrlBasePath(
    pathname: string = typeof window !== 'undefined'
        ? window.location.pathname
        : ''
): boolean {
    return Object.values(PATH_FOR_BASE_TYPE).some((prefix) =>
        pathname.startsWith(prefix)
    )
}

/** Path a base of this type lives at (no origin), e.g. `/map/<id>`. */
export function baseTypePath(baseId: string, baseType: BaseType): string {
    return `${PATH_FOR_BASE_TYPE[baseType] ?? PATH_FOR_BASE_TYPE[DEFAULT_BASE_TYPE]}${baseId}`
}

/** Absolute link to a base — what Share copies and what the user pastes. */
export function baseTypeUrl(baseId: string, baseType: BaseType): string {
    return `${window.location.origin}${baseTypePath(baseId, baseType)}`
}
