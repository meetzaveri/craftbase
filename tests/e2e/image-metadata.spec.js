import { test, expect } from './helpers/test.js'
import {
    setupLocalBoard,
    getCanvasBox,
    getDraftComponents,
} from './helpers/index.js'

/**
 * Photo metadata is stripped before an image reaches storage.
 *
 * Each test builds a real image in the page (canvas-encoded JPEG/PNG/WebP, or
 * a hand-built GIF), injects metadata blocks carrying a "SECRET" marker
 * string, drops it on the canvas, and then inspects the bytes that landed in
 * IndexedDB. Small images take the no-re-encode path, so the stored file must
 * keep its format and decode to exactly the same pixels, with metadata gone.
 */

const DRAFT_DEBOUNCE_MS = 700
const IMAGE_NODE = '[data-component-type="image"] image[data-cb-image]'

// Builds the test file in the page. `kind` picks the format; returns
// { file: base64, clean: base64 | null } where `clean` is the expected stored
// bytes when stripping must be lossless.
async function buildImage(page, kind, opts = {}) {
    return page.evaluate(
        async ({ kind, opts }) => {
            const enc = new TextEncoder()
            const b64 = (u8) => {
                let s = ''
                for (let i = 0; i < u8.length; i++)
                    s += String.fromCharCode(u8[i])
                return btoa(s)
            }
            const cat = (...parts) => {
                const out = new Uint8Array(
                    parts.reduce((n, p) => n + p.length, 0)
                )
                let o = 0
                for (const p of parts) {
                    out.set(p, o)
                    o += p.length
                }
                return out
            }
            const be16 = (n) => new Uint8Array([(n >> 8) & 255, n & 255])
            const be32 = (n) =>
                new Uint8Array([
                    (n >>> 24) & 255,
                    (n >>> 16) & 255,
                    (n >>> 8) & 255,
                    n & 255,
                ])
            const le32 = (n) =>
                new Uint8Array([
                    n & 255,
                    (n >>> 8) & 255,
                    (n >>> 16) & 255,
                    (n >>> 24) & 255,
                ])
            const crcTable = Array.from({ length: 256 }, (_, n) => {
                let c = n
                for (let k = 0; k < 8; k++)
                    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
                return c >>> 0
            })
            const crc32 = (u8) => {
                let c = 0xffffffff
                for (const byte of u8)
                    c = crcTable[(c ^ byte) & 255] ^ (c >>> 8)
                return (c ^ 0xffffffff) >>> 0
            }
            // Big-endian TIFF with one IFD0 entry: Orientation, plus a GPS
            // marker string after the IFD (enough to prove the block is gone).
            const exifTiff = (orientation) =>
                cat(
                    enc.encode('MM'),
                    be16(42),
                    be32(8),
                    be16(1),
                    be16(0x0112),
                    be16(3),
                    be32(1),
                    be16(orientation),
                    be16(0),
                    be32(0),
                    enc.encode('GPS-SECRET')
                )
            const canvasBytes = async (w, h, type) => {
                const c = document.createElement('canvas')
                c.width = w
                c.height = h
                const ctx = c.getContext('2d')
                ctx.fillStyle = '#e11d48'
                ctx.fillRect(0, 0, w, h)
                ctx.fillStyle = '#2563eb'
                ctx.fillRect(0, 0, w / 2, h / 2)
                const blob = await new Promise((r) => c.toBlob(r, type, 0.9))
                return new Uint8Array(await blob.arrayBuffer())
            }

            if (kind === 'jpeg') {
                const clean = await canvasBytes(
                    opts.w ?? 300,
                    opts.h ?? 200,
                    'image/jpeg'
                )
                const seg = (marker, payload) =>
                    cat(
                        new Uint8Array([0xff, marker]),
                        be16(payload.length + 2),
                        payload
                    )
                const exif = seg(
                    0xe1,
                    cat(enc.encode('Exif\0\0'), exifTiff(opts.orientation ?? 1))
                )
                const xmp = seg(
                    0xe1,
                    enc.encode(
                        'http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>XMP-SECRET</x:xmpmeta>'
                    )
                )
                const iptc = seg(0xed, enc.encode('Photoshop 3.0\0IPTC-SECRET'))
                const com = seg(0xfe, enc.encode('COMMENT-SECRET'))
                const file = cat(
                    clean.subarray(0, 2),
                    exif,
                    xmp,
                    iptc,
                    com,
                    clean.subarray(2),
                    // Bytes after EOI, like a phone's appended depth map.
                    enc.encode('TRAILER-SECRET')
                )
                return { file: b64(file), clean: b64(clean) }
            }

            if (kind === 'png') {
                const clean = await canvasBytes(300, 200, 'image/png')
                const chunk = (type, data) => {
                    const td = cat(enc.encode(type), data)
                    return cat(be32(data.length), td, be32(crc32(td)))
                }
                const ihdrEnd = 8 + 12 + 13
                const file = cat(
                    clean.subarray(0, ihdrEnd),
                    chunk('tEXt', enc.encode('Comment\0TEXT-SECRET')),
                    chunk(
                        'iTXt',
                        enc.encode('XML:com.adobe.xmp\0\0\0\0\0XMP-SECRET')
                    ),
                    chunk('eXIf', exifTiff(1)),
                    clean.subarray(ihdrEnd)
                )
                return { file: b64(file), clean: b64(clean) }
            }

            if (kind === 'webp') {
                const encoded = await canvasBytes(300, 200, 'image/webp')
                // Chrome's canvas may emit the simple format (bare VP8) or
                // the extended one (VP8X header first). Reuse its VP8X when
                // present, else add one, so EXIF and XMP chunks are legal.
                const u24 = (n) =>
                    new Uint8Array([n & 255, (n >> 8) & 255, (n >> 16) & 255])
                const hasVp8x =
                    String.fromCharCode(...encoded.subarray(12, 16)) === 'VP8X'
                const baseVp8x = hasVp8x
                    ? encoded.slice(12, 30)
                    : cat(
                          enc.encode('VP8X'),
                          le32(10),
                          new Uint8Array([0, 0, 0, 0]),
                          u24(299),
                          u24(199)
                      )
                const vp8 = encoded.subarray(hasVp8x ? 30 : 12)
                const vp8x = (extraFlags) => {
                    const chunk = baseVp8x.slice()
                    chunk[8] |= extraFlags
                    return chunk
                }
                const riffChunk = (fourcc, data) =>
                    cat(
                        enc.encode(fourcc),
                        le32(data.length),
                        data,
                        data.length % 2 ? new Uint8Array([0]) : new Uint8Array()
                    )
                const riff = (body) =>
                    cat(
                        enc.encode('RIFF'),
                        le32(body.length + 4),
                        enc.encode('WEBP'),
                        body
                    )
                const clean = riff(cat(vp8x(0), vp8))
                const file = riff(
                    cat(
                        vp8x(0x08 | 0x04),
                        vp8,
                        riffChunk('EXIF', exifTiff(1)),
                        riffChunk(
                            'XMP ',
                            enc.encode('<x:xmpmeta>XMP-SECRET</x:xmpmeta>')
                        )
                    )
                )
                return { file: b64(file), clean: b64(clean) }
            }

            if (kind === 'gif') {
                // 1x1 GIF89a with a looping NETSCAPE block (must survive).
                const head = new Uint8Array([
                    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0x80, 0, 0,
                    0xff, 0x00, 0x00, 0, 0, 0,
                ])
                const netscape = cat(
                    new Uint8Array([0x21, 0xff, 11]),
                    enc.encode('NETSCAPE2.0'),
                    new Uint8Array([3, 1, 0, 0, 0])
                )
                const frame = new Uint8Array([
                    0x21, 0xf9, 4, 0, 0, 0, 0, 0, 0x2c, 0, 0, 0, 0, 1, 0, 1, 0,
                    0, 2, 2, 0x44, 0x01, 0,
                ])
                const trailer = new Uint8Array([0x3b])
                const comment = cat(
                    new Uint8Array([0x21, 0xfe, 14]),
                    enc.encode('COMMENT-SECRET'),
                    new Uint8Array([0])
                )
                const xmpPayload = enc.encode(
                    '<x:xmpmeta>XMP-SECRET</x:xmpmeta>'
                )
                const xmp = cat(
                    new Uint8Array([0x21, 0xff, 11]),
                    enc.encode('XMP DataXMP'),
                    new Uint8Array([xmpPayload.length]),
                    xmpPayload,
                    new Uint8Array([0])
                )
                const clean = cat(head, netscape, frame, trailer)
                const file = cat(head, netscape, comment, xmp, frame, trailer)
                return { file: b64(file), clean: b64(clean) }
            }
            throw new Error(`unknown kind ${kind}`)
        },
        { kind, opts }
    )
}

async function dropFile(page, base64, mimeType) {
    const box = await getCanvasBox(page)
    const dataTransfer = await page.evaluateHandle(
        ({ base64, mimeType }) => {
            const bin = atob(base64)
            const bytes = new Uint8Array(bin.length)
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
            const dt = new DataTransfer()
            dt.items.add(new File([bytes], 'photo', { type: mimeType }))
            return dt
        },
        { base64, mimeType }
    )
    const init = {
        dataTransfer,
        clientX: Math.round(box.x + box.width * 0.5),
        clientY: Math.round(box.y + box.height * 0.5),
        bubbles: true,
    }
    await page.dispatchEvent('#main-two-root', 'dragover', init)
    await page.dispatchEvent('#main-two-root', 'drop', init)
    // Wait for the bitmap to actually paint: proves the stripped file still
    // decodes in the browser.
    await page.waitForFunction(() => {
        const g = document.querySelector('[data-component-type="image"]')
        const frame = g?.querySelector('path, rect')
        return (
            g?.querySelector('image[data-cb-image]') &&
            frame?.getAttribute('fill') === 'transparent'
        )
    })
    await page.waitForTimeout(DRAFT_DEBOUNCE_MS)
}

// Stored record plus its asset bytes (base64) and MIME type from IndexedDB.
async function readStored(page) {
    const draft = (await getDraftComponents(page)) || {}
    const record = Object.values(draft).find((c) => c.componentType === 'image')
    const asset = await page.evaluate(
        (id) =>
            new Promise((resolve, reject) => {
                const open = indexedDB.open('craftbase-assets')
                open.onerror = () => reject(open.error)
                open.onsuccess = () => {
                    const req = open.result
                        .transaction('images', 'readonly')
                        .objectStore('images')
                        .get(id)
                    req.onerror = () => reject(req.error)
                    req.onsuccess = () => {
                        const u8 = new Uint8Array(req.result.bytes)
                        let s = ''
                        for (let i = 0; i < u8.length; i++)
                            s += String.fromCharCode(u8[i])
                        resolve({ base64: btoa(s), type: req.result.type })
                    }
                }
            }),
        record.metadata.assetId
    )
    return { record, asset }
}

const latin1 = (base64) => Buffer.from(base64, 'base64').toString('latin1')

// Our injected markers, plus the signatures of metadata blocks any encoder
// might write (Safari's canvas adds EXIF to JPEG and PNG output).
function expectNoMetadata(base64) {
    const text = latin1(base64)
    expect(text).not.toMatch(/SECRET/)
    expect(text).not.toContain('Exif\0\0')
    expect(text).not.toContain('eXIf')
    expect(text).not.toContain('tEXt')
    expect(text).not.toContain('iTXt')
    expect(text).not.toContain('Photoshop 3.0')
    expect(text).not.toContain('ns.adobe.com/xap')
}

// Stripping must not touch pixels. Compare decoded pixels rather than bytes:
// the reference is the browser's own canvas output, which in Safari carries
// metadata of its own that the stripper rightly removes.
async function expectSamePixels(page, storedBase64, referenceBase64, type) {
    const same = await page.evaluate(
        async ({ a, b, type }) => {
            const pixels = async (b64) => {
                const bin = atob(b64)
                const u8 = new Uint8Array(bin.length)
                for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
                const bitmap = await createImageBitmap(new Blob([u8], { type }))
                const c = document.createElement('canvas')
                c.width = bitmap.width
                c.height = bitmap.height
                const ctx = c.getContext('2d')
                ctx.drawImage(bitmap, 0, 0)
                return Array.from(
                    ctx.getImageData(0, 0, c.width, c.height).data
                ).join(',')
            }
            return (await pixels(a)) === (await pixels(b))
        },
        { a: storedBase64, b: referenceBase64, type }
    )
    expect(same).toBe(true)
}

test.describe('Image metadata is stripped on add', () => {
    test.beforeEach(async ({ page }) => {
        await setupLocalBoard(page)
    })

    test('JPEG: EXIF, XMP, IPTC, comments and trailing data are removed, pixels untouched', async ({
        page,
    }) => {
        const { file, clean } = await buildImage(page, 'jpeg')
        expect(latin1(file)).toMatch(/GPS-SECRET/)

        await dropFile(page, file, 'image/jpeg')
        const { asset } = await readStored(page)

        expectNoMetadata(asset.base64)
        expect(asset.type).toBe('image/jpeg')
        await expectSamePixels(page, asset.base64, clean, 'image/jpeg')
    })

    test('JPEG with a rotation tag is re-encoded upright, without metadata', async ({
        page,
    }) => {
        // Orientation 6 = rotate 90° clockwise, so 300x200 displays as 200x300.
        const { file } = await buildImage(page, 'jpeg', { orientation: 6 })

        await dropFile(page, file, 'image/jpeg')
        const { record, asset } = await readStored(page)

        expectNoMetadata(asset.base64)
        expect(record.metadata.naturalWidth).toBe(200)
        expect(record.metadata.naturalHeight).toBe(300)
        expect(record.width).toBe(200)
        expect(record.height).toBe(300)
    })

    test('PNG: text, XMP and eXIf chunks are removed, pixels untouched', async ({
        page,
    }) => {
        const { file, clean } = await buildImage(page, 'png')

        await dropFile(page, file, 'image/png')
        const { asset } = await readStored(page)

        expectNoMetadata(asset.base64)
        expect(asset.type).toBe('image/png')
        await expectSamePixels(page, asset.base64, clean, 'image/png')
    })

    test('WebP: EXIF and XMP chunks and their header flags are removed', async ({
        page,
        browserName,
    }) => {
        // WebKit's canvas can't encode WebP (it silently returns PNG), so
        // the fixture can't be built there.
        test.skip(browserName === 'webkit', 'no WebP encoder in WebKit canvas')
        const { file, clean } = await buildImage(page, 'webp')

        await dropFile(page, file, 'image/webp')
        const { asset } = await readStored(page)

        expectNoMetadata(asset.base64)
        expect(asset.type).toBe('image/webp')
        await expectSamePixels(page, asset.base64, clean, 'image/webp')
    })

    test('GIF: comments and XMP are removed, the loop block is kept', async ({
        page,
    }) => {
        const { file, clean } = await buildImage(page, 'gif')

        await dropFile(page, file, 'image/gif')
        const { asset } = await readStored(page)

        expectNoMetadata(asset.base64)
        expect(latin1(asset.base64)).toMatch(/NETSCAPE2\.0/)
        // Hand-built, so the clean reference has no metadata in any
        // browser and the bytes must match exactly.
        expect(asset.base64).toBe(clean)
    })
})
