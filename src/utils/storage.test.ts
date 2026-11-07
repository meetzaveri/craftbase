import { beforeEach, describe, expect, it } from 'vitest'
import {
    cbStorage,
    configureStorage,
    getStorageMode,
    promoteMemoryToLocal,
    resetMemoryStorage,
} from './storage'

describe('cbStorage', () => {
    beforeEach(() => {
        window.localStorage.clear()
        resetMemoryStorage()
        configureStorage({ mode: 'local', namespace: '' })
    })

    it('app mode reads and writes the plain craftbase_ keys', () => {
        cbStorage.setItem('craftbase_local_draft', '{}')
        expect(window.localStorage.getItem('craftbase_local_draft')).toBe('{}')
        expect(cbStorage.getItem('craftbase_local_draft')).toBe('{}')
    })

    it('a namespace is added as a suffix, keeping the craftbase_ prefix', () => {
        configureStorage({ mode: 'local', namespace: 'demo' })
        cbStorage.setItem('craftbase_user_id', 'u1')
        expect(window.localStorage.getItem('craftbase_user_id__demo')).toBe(
            'u1'
        )
        expect(window.localStorage.getItem('craftbase_user_id')).toBeNull()
        expect(cbStorage.getItem('craftbase_user_id')).toBe('u1')
        expect(cbStorage.keys()).toEqual(['craftbase_user_id'])
    })

    it('keys() ignores host keys and other namespaces', () => {
        window.localStorage.setItem('hostKey', 'x')
        window.localStorage.setItem('craftbase_pan_mode__other', 'true')
        window.localStorage.setItem('craftbase_pan_mode', 'true')
        expect(cbStorage.keys()).toEqual(['craftbase_pan_mode'])
        configureStorage({ namespace: 'other' })
        expect(cbStorage.keys()).toEqual(['craftbase_pan_mode'])
        expect(cbStorage.getItem('craftbase_pan_mode')).toBe('true')
    })

    it('memory mode never touches localStorage', () => {
        configureStorage({ mode: 'memory', namespace: 'demo' })
        cbStorage.setItem('craftbase_local_draft', 'draft')
        expect(cbStorage.getItem('craftbase_local_draft')).toBe('draft')
        expect(window.localStorage.length).toBe(0)
        cbStorage.removeItem('craftbase_local_draft')
        expect(cbStorage.getItem('craftbase_local_draft')).toBeNull()
    })

    it('promoteMemoryToLocal carries the session into localStorage', () => {
        configureStorage({ mode: 'memory', namespace: 'demo' })
        cbStorage.setItem('craftbase_local_draft', 'draft')
        promoteMemoryToLocal()
        expect(getStorageMode()).toBe('local')
        expect(window.localStorage.getItem('craftbase_local_draft__demo')).toBe(
            'draft'
        )
        expect(cbStorage.getItem('craftbase_local_draft')).toBe('draft')
    })
})
