import { beforeEach, describe, expect, it } from 'vitest'
import { migrateLegacyStorageKeys } from './legacyStorageKeys'

describe('migrateLegacyStorageKeys', () => {
    beforeEach(() => window.localStorage.clear())

    it('moves old keys to their craftbase_ names', () => {
        window.localStorage.setItem('userId', 'u1')
        window.localStorage.setItem('cb-theme', 'dark')
        window.localStorage.setItem('craftbase:elementDefaults', '{"a":1}')
        window.localStorage.setItem('panMode', 'true')
        window.localStorage.setItem('tabs_open_b1', '2')
        window.localStorage.setItem('__craftbase_fit_probe__', 'x')
        migrateLegacyStorageKeys()
        expect(Object.fromEntries(Object.entries(window.localStorage))).toEqual(
            {
                craftbase_user_id: 'u1',
                craftbase_theme: 'dark',
                craftbase_element_defaults: '{"a":1}',
                craftbase_pan_mode: 'true',
                craftbase_tabs_open_b1: '2',
            }
        )
    })

    it('never overwrites a value already under the new name', () => {
        window.localStorage.setItem('userId', 'old')
        window.localStorage.setItem('craftbase_user_id', 'new')
        migrateLegacyStorageKeys()
        expect(window.localStorage.getItem('craftbase_user_id')).toBe('new')
        expect(window.localStorage.getItem('userId')).toBeNull()
    })

    it('leaves host keys and existing craftbase_ keys alone', () => {
        window.localStorage.setItem('hostToken', 't')
        window.localStorage.setItem('craftbase_local_draft', '{}')
        migrateLegacyStorageKeys()
        expect(window.localStorage.getItem('hostToken')).toBe('t')
        expect(window.localStorage.getItem('craftbase_local_draft')).toBe('{}')
    })
})
