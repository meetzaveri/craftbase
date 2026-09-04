import type { ComponentStore } from '../types/board'
import { GROUP_COMPONENT } from '../constants/misc'
import { isWelcomeComponent } from './welcomeSketch'
import { version as appVersion } from '../../package.json'

interface BoardViewport {
    scale: number
    tx: number
    ty: number
}

/**
 * Serialize the current board to a versioned, branded JSON envelope and
 * trigger a browser download. Reuses the same canonical `ComponentStore`
 * the localStorage draft persists, so round-trip fidelity is inherited.
 */
export function exportBoardAsJson(
    componentStore: ComponentStore,
    viewport: BoardViewport
): void {
    // Same save-side filter as useLocalDraftPersistence.ts — drop transient
    // groups and onboarding welcome-sketch seeds so they never leave the app.
    const components = Object.fromEntries(
        Object.entries(componentStore).filter(
            ([, v]) =>
                v?.componentType !== GROUP_COMPONENT &&
                !isWelcomeComponent(v)
        )
    ) as ComponentStore

    const payload = {
        formatVersion: '1.0',
        app: 'craftbase',
        appVersion,
        exportedAt: Date.now(),
        viewport,
        components,
    }
    downloadJson(JSON.stringify(payload, null, 2))
}

/** Trigger a browser download of the JSON payload as a .json file. */
function downloadJson(json: string): void {
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `craftbase-board-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}
