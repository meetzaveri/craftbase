import { useCallback, useEffect, useState } from 'react'
import { cbStorage } from '../utils/storage'
import { THEME_KEY } from '../constants/misc'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = THEME_KEY
const DARK_QUERY = '(prefers-color-scheme: dark)'

const isThemePreference = (value: unknown): value is ThemePreference =>
    value === 'light' || value === 'dark' || value === 'system'

const readStoredTheme = (): ThemePreference => {
    // Default to light (not system) when the user hasn't picked a preference.
    if (typeof window === 'undefined') return 'light'
    const stored = cbStorage.getItem(STORAGE_KEY)
    return isThemePreference(stored) ? stored : 'light'
}

const systemPrefersDark = (): boolean =>
    typeof window !== 'undefined' &&
    window.matchMedia(DARK_QUERY).matches

const resolveTheme = (theme: ThemePreference): ResolvedTheme => {
    if (theme === 'system') return systemPrefersDark() ? 'dark' : 'light'
    return theme
}

const applyResolvedTheme = (resolved: ResolvedTheme): void => {
    if (typeof document === 'undefined') return
    document.documentElement.classList.toggle('dark', resolved === 'dark')
}

/**
 * Theme selector state for the Light / Dark / System dropdown.
 *
 * Single source of truth that:
 * - persists the preference to localStorage ('craftbase_theme'), defaulting to 'light'
 * - toggles the `dark` class on <html> (Tailwind class-based dark mode)
 * - when in 'system' mode, follows the OS `prefers-color-scheme` live
 *
 * The pre-paint script in index.html applies the same logic before React mounts
 * to avoid a light flash; this hook keeps it in sync afterwards.
 */
export const useTheme = (): {
    theme: ThemePreference
    setTheme: (next: ThemePreference) => void
    resolvedTheme: ResolvedTheme
} => {
    const [theme, setThemeState] = useState<ThemePreference>(readStoredTheme)
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
        resolveTheme(readStoredTheme())
    )

    const setTheme = useCallback((next: ThemePreference): void => {
        if (typeof window !== 'undefined') {
            cbStorage.setItem(STORAGE_KEY, next)
        }
        setThemeState(next)
    }, [])

    useEffect(() => {
        const apply = (): void => {
            const resolved = resolveTheme(theme)
            applyResolvedTheme(resolved)
            setResolvedTheme(resolved)
        }
        apply()

        // Only the 'system' preference tracks live OS changes.
        if (theme !== 'system' || typeof window === 'undefined') return
        const mediaQuery = window.matchMedia(DARK_QUERY)
        mediaQuery.addEventListener('change', apply)
        return (): void => {
            mediaQuery.removeEventListener('change', apply)
        }
    }, [theme])

    return { theme, setTheme, resolvedTheme }
}
