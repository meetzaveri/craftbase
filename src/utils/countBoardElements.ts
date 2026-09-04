import { GROUP_COMPONENT } from '../constants/misc'
import { isWelcomeComponent } from './welcomeSketch'
import type { ComponentStore } from '../types/board'

/**
 * Element count above which the canvas starts to feel sluggish and we warn the
 * user once. Chosen from the render-batching work: past roughly this many
 * elements the per-element Two.js bookkeeping dominates interaction cost.
 */
export const PERFORMANCE_WARNING_THRESHOLD = 2000

/**
 * Number of *real user elements* on a board.
 *
 * Two kinds of entries live in the store but are not user content, and both are
 * excluded here for the same reasons the draft-save path skips them:
 *   - `groupobject` — a transient selection wrapper, never persisted
 *   - welcome-sketch seeds — onboarding scaffolding
 */
export const countBoardElements = (store: ComponentStore): number =>
    Object.values(store).filter(
        (v) => v?.componentType !== GROUP_COMPONENT && !isWelcomeComponent(v)
    ).length
