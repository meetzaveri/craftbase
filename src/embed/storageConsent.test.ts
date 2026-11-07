import { beforeEach, describe, expect, it } from 'vitest'
import {
    denyStorageConsent,
    grantStorageConsent,
    initEmbedStorage,
    readConsent,
} from './storageConsent'
import { cbStorage, getStorageMode, resetMemoryStorage } from '../utils/storage'

describe('embed storage consent', () => {
    beforeEach(() => {
        window.localStorage.clear()
        resetMemoryStorage()
    })

    it("'ask' with no answer: memory mode and the banner shows", () => {
        expect(initEmbedStorage('ask').needsConsent).toBe(true)
        expect(getStorageMode()).toBe('memory')
    })

    it('granting moves the in-memory board to localStorage', () => {
        initEmbedStorage('ask', 'demo')
        cbStorage.setItem('craftbase_local_draft', 'draft')
        expect(
            window.localStorage.getItem('craftbase_local_draft__demo')
        ).toBeNull()
        grantStorageConsent()
        expect(readConsent()).toBe('granted')
        expect(window.localStorage.getItem('craftbase_local_draft__demo')).toBe(
            'draft'
        )
        // Next load: no banner, straight to localStorage.
        expect(initEmbedStorage('ask', 'demo').needsConsent).toBe(false)
        expect(getStorageMode()).toBe('local')
    })

    it('denying stores only the answer, never board data', () => {
        initEmbedStorage('ask')
        cbStorage.setItem('craftbase_local_draft', 'draft')
        denyStorageConsent()
        expect(Object.keys(window.localStorage)).toEqual([
            'craftbase_storage_consent',
        ])
        expect(initEmbedStorage('ask').needsConsent).toBe(false)
        expect(getStorageMode()).toBe('memory')
    })

    it("'local' and 'memory' skip the banner", () => {
        expect(initEmbedStorage('local').needsConsent).toBe(false)
        expect(getStorageMode()).toBe('local')
        expect(initEmbedStorage('memory').needsConsent).toBe(false)
        expect(getStorageMode()).toBe('memory')
    })

    it('every key an embed writes starts with craftbase_', () => {
        initEmbedStorage('local', 'My Board!')
        cbStorage.setItem('craftbase_pan_mode', 'true')
        grantStorageConsent()
        for (const k of Object.keys(window.localStorage)) {
            expect(k.startsWith('craftbase_')).toBe(true)
        }
        expect(
            window.localStorage.getItem('craftbase_pan_mode__my-board')
        ).toBe('true')
    })
})
