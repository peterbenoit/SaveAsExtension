'use strict';

// Globals are set in tests/setup.js via jest.config.js setupFiles.
// background.js wires chrome event listeners at module load — those calls hit
// the mocked chrome object and are safe no-ops.

let getFileNameFromURL, ALLOWED_FORMATS, checkAvifEncodingSupport, convertBlobToURL;

beforeAll(() => {
	jest.resetModules();
	({ getFileNameFromURL, ALLOWED_FORMATS, checkAvifEncodingSupport, convertBlobToURL } =
		require('../background'));
});

beforeEach(() => {
	jest.clearAllMocks();
});

// ── getFileNameFromURL ─────────────────────────────────────────────────────────

describe('getFileNameFromURL', () => {
	test('extracts filename and applies the new extension', () => {
		expect(getFileNameFromURL('https://example.com/photo.jpg', 'png')).toBe('photo.png');
	});

	test('handles a deep path', () => {
		expect(getFileNameFromURL('https://example.com/a/b/c/logo.svg', 'webp')).toBe('logo.webp');
	});

	test('falls back to image.<ext> for the root path', () => {
		expect(getFileNameFromURL('https://example.com/', 'jpg')).toBe('image.jpg');
	});

	test('falls back to image.<ext> when the URL has no path segments', () => {
		expect(getFileNameFromURL('https://example.com', 'png')).toBe('image.png');
	});

	test('decodes a URL-encoded filename', () => {
		expect(getFileNameFromURL('https://example.com/My%20Photo.png', 'pdf')).toBe(
			'My Photo.pdf'
		);
	});

	test('handles a filename with no extension', () => {
		expect(getFileNameFromURL('https://example.com/image', 'jpg')).toBe('image.jpg');
	});

	test('ignores the query string when extracting the filename', () => {
		expect(getFileNameFromURL('https://cdn.example.com/file.png?v=123', 'webp')).toBe(
			'file.webp'
		);
	});

	test('falls back to image.<ext> for an empty string', () => {
		expect(getFileNameFromURL('', 'png')).toBe('image.png');
	});

	test('strips invalid percent sequences and replaces bare % characters', () => {
		// %ZZ cannot be decoded; the raw % is replaced with _
		const result = getFileNameFromURL('https://example.com/%ZZfile.png', 'jpg');
		expect(result).toMatch(/\.jpg$/);
		expect(result).not.toContain('%');
	});

	test('handles a filename that is only an extension (e.g. .hidden)', () => {
		// The regex should still extract something usable
		const result = getFileNameFromURL('https://example.com/.hidden', 'png');
		expect(result).toMatch(/\.png$/);
	});
});

// ── ALLOWED_FORMATS ────────────────────────────────────────────────────────────

describe('ALLOWED_FORMATS', () => {
	test('contains all six expected format strings', () => {
		for (const fmt of ['png', 'jpg', 'webp', 'avif', 'gif', 'pdf']) {
			expect(ALLOWED_FORMATS.has(fmt)).toBe(true);
		}
	});

	test('has exactly six entries', () => {
		expect(ALLOWED_FORMATS.size).toBe(6);
	});

	test('rejects unknown and miscased format strings', () => {
		expect(ALLOWED_FORMATS.has('exe')).toBe(false);
		expect(ALLOWED_FORMATS.has('svg')).toBe(false);
		expect(ALLOWED_FORMATS.has('')).toBe(false);
		expect(ALLOWED_FORMATS.has('PNG')).toBe(false); // set is case-sensitive
		expect(ALLOWED_FORMATS.has('JPG')).toBe(false);
	});
});

// ── checkAvifEncodingSupport (background.js, uses OffscreenCanvas) ─────────────

describe('checkAvifEncodingSupport', () => {
	test('returns true when OffscreenCanvas produces an image/avif blob', async () => {
		global.OffscreenCanvas = class {
			constructor(w, h) {
				this.width = w;
				this.height = h;
			}
			getContext() {
				return { fillStyle: '', fillRect: jest.fn() };
			}
			convertToBlob() {
				return Promise.resolve(new Blob([], { type: 'image/avif' }));
			}
		};
		expect(await checkAvifEncodingSupport()).toBe(true);
	});

	test('returns false when the canvas silently returns PNG instead of AVIF', async () => {
		global.OffscreenCanvas = class {
			constructor(w, h) {
				this.width = w;
				this.height = h;
			}
			getContext() {
				return { fillStyle: '', fillRect: jest.fn() };
			}
			convertToBlob() {
				return Promise.resolve(new Blob([], { type: 'image/png' }));
			}
		};
		expect(await checkAvifEncodingSupport()).toBe(false);
	});

	test('returns false when convertToBlob rejects', async () => {
		global.OffscreenCanvas = class {
			constructor(w, h) {
				this.width = w;
				this.height = h;
			}
			getContext() {
				return { fillStyle: '', fillRect: jest.fn() };
			}
			convertToBlob() {
				return Promise.reject(new Error('Unsupported format'));
			}
		};
		expect(await checkAvifEncodingSupport()).toBe(false);
	});
});

// ── convertBlobToURL ───────────────────────────────────────────────────────────

describe('convertBlobToURL', () => {
	let convertToBlobMock;

	beforeEach(() => {
		// Default: always returns PNG (simulates a browser without AVIF support)
		convertToBlobMock = jest
			.fn()
			.mockImplementation(async () => new Blob(['x'], { type: 'image/png' }));

		global.OffscreenCanvas = jest.fn().mockImplementation((w, h) => ({
			width: w,
			height: h,
			// fillRect is called by checkAvifEncodingSupport; it must exist or the
			// outer try/catch silently returns false, masking the AVIF test.
			getContext: () => ({ drawImage: jest.fn(), fillRect: jest.fn() }),
			convertToBlob: convertToBlobMock,
		}));

		global.createImageBitmap = jest.fn().mockResolvedValue({ width: 100, height: 100 });
	});

	test('returns a data URL for PNG format', async () => {
		const result = await convertBlobToURL(new Blob(['x'], { type: 'image/png' }), 'png');
		expect(result.imageUrl).toMatch(/^data:/);
		expect(convertToBlobMock).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'image/png' })
		);
	});

	test('requests JPEG with quality 0.92 for JPG format', async () => {
		await convertBlobToURL(new Blob(['x']), 'jpg');
		expect(convertToBlobMock).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'image/jpeg', quality: 0.92 })
		);
	});

	test('requests WebP with quality 0.9 for WEBP format', async () => {
		await convertBlobToURL(new Blob(['x']), 'webp');
		expect(convertToBlobMock).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'image/webp', quality: 0.9 })
		);
	});

	test('uses PNG content for GIF format due to Canvas API limitation', async () => {
		await convertBlobToURL(new Blob(['x'], { type: 'image/gif' }), 'gif');
		// Must request PNG, never GIF
		expect(convertToBlobMock).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'image/png' })
		);
		expect(convertToBlobMock).not.toHaveBeenCalledWith(
			expect.objectContaining({ type: 'image/gif' })
		);
	});

	test('uses AVIF with quality 0.8 when AVIF encoding is supported', async () => {
		// Override: returns whatever type was requested (AVIF-capable browser)
		convertToBlobMock.mockImplementation(async ({ type } = {}) => new Blob(['x'], { type }));

		await convertBlobToURL(new Blob(['x']), 'avif');

		expect(convertToBlobMock).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'image/avif', quality: 0.8 })
		);
	});

	test('falls back to PNG when AVIF encoding is not supported', async () => {
		// convertToBlobMock already returns PNG — simulates no AVIF support
		await convertBlobToURL(new Blob(['x']), 'avif');

		// No call should request AVIF with a quality value
		expect(convertToBlobMock).not.toHaveBeenCalledWith(
			expect.objectContaining({ type: 'image/avif', quality: 0.8 })
		);
	});

	test('throws when createImageBitmap rejects for a zero-byte blob', async () => {
		global.createImageBitmap = jest
			.fn()
			.mockRejectedValue(new Error('Failed to decode image data'));
		await expect(convertBlobToURL(new Blob([]), 'png')).rejects.toThrow();
	});

	test('throws when createImageBitmap rejects for an SVG source', async () => {
		global.createImageBitmap = jest
			.fn()
			.mockRejectedValue(new Error('The source image could not be decoded'));
		await expect(
			convertBlobToURL(new Blob(['<svg/>'], { type: 'image/svg+xml' }), 'png')
		).rejects.toThrow();
	});
});
