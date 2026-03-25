'use strict';

// Globals are set in tests/setup.js via jest.config.js setupFiles.
// offscreen.js assigns to navigator.serviceWorker.onmessage at module load —
// that hits the mocked navigator and is a safe no-op.

let checkAvifEncodingSupport, messageHandlers, MAX_PDF_DIMENSION;

beforeAll(() => {
	jest.resetModules();
	({ checkAvifEncodingSupport, messageHandlers, MAX_PDF_DIMENSION } =
		require('../offscreen'));
});

beforeEach(() => {
	jest.clearAllMocks();
	// Restore a clean document.createElement for each test
	global.document.createElement = jest.fn((tag) => {
		if (tag === 'canvas') return makeMockCanvas();
		if (tag === 'img') return makeMockImg(100, 100);
		return {};
	});
	// Restore URL mocks
	global.URL.createObjectURL = jest.fn().mockReturnValue('blob:fake://test-blob');
	global.URL.revokeObjectURL = jest.fn();
});

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Creates a mock canvas element.
 * @param {boolean} avifSupported - Whether toDataURL should return AVIF data URLs.
 */
function makeMockCanvas(avifSupported = false) {
	return {
		width: 0,
		height: 0,
		getContext: () => ({ drawImage: jest.fn() }),
		toDataURL: jest.fn((type) =>
			avifSupported && type === 'image/avif'
				? 'data:image/avif;base64,ZmFrZQ=='
				: 'data:image/png;base64,ZmFrZQ=='
		),
	};
}

/**
 * Creates a mock img element.
 * Setting .src triggers img.onload (or img.onerror if fail=true) as a microtask.
 */
function makeMockImg(width, height, fail = false) {
	const img = {
		naturalWidth: width,
		naturalHeight: height,
		onload: null,
		onerror: null,
		decode: jest.fn().mockResolvedValue(undefined),
	};
	Object.defineProperty(img, 'src', {
		set(_val) {
			Promise.resolve().then(() => {
				if (fail) {
					img.onerror && img.onerror(new Event('error'));
				} else {
					img.onload && img.onload();
				}
			});
		},
		configurable: true,
	});
	return img;
}

// ── checkAvifEncodingSupport (offscreen.js, uses document canvas) ──────────────

describe('checkAvifEncodingSupport (offscreen)', () => {
	test('returns true when canvas.toDataURL produces an AVIF data URL', async () => {
		global.document.createElement = jest.fn(() => makeMockCanvas(true));
		expect(await checkAvifEncodingSupport()).toBe(true);
	});

	test('returns false when canvas.toDataURL returns a non-AVIF data URL', async () => {
		global.document.createElement = jest.fn(() => makeMockCanvas(false));
		expect(await checkAvifEncodingSupport()).toBe(false);
	});

	test('returns false when toDataURL throws', async () => {
		global.document.createElement = jest.fn(() => ({
			width: 0,
			height: 0,
			getContext: () => ({}),
			toDataURL: jest.fn(() => {
				throw new Error('Not supported');
			}),
		}));
		expect(await checkAvifEncodingSupport()).toBe(false);
	});
});

// ── createPDFFromBlob handler ─────────────────────────────────────────────────

describe('createPDFFromBlob handler', () => {
	let handler;
	let MockJsPDF;
	let mockDocInstance;

	beforeEach(() => {
		handler = messageHandlers.get('createPDFFromBlob');

		mockDocInstance = {
			addImage: jest.fn(),
			output: jest.fn().mockReturnValue('data:application/pdf;base64,fakepdf'),
		};
		MockJsPDF = jest.fn().mockReturnValue(mockDocInstance);
		global.window = { jspdf: { jsPDF: MockJsPDF }, close: jest.fn() };
	});

	function setupImg(width, height, fail = false) {
		const mockImg = makeMockImg(width, height, fail);
		global.document.createElement = jest.fn((tag) =>
			tag === 'img' ? mockImg : {}
		);
		return mockImg;
	}

	test('uses landscape orientation when image width > height', async () => {
		setupImg(800, 600);
		const result = await handler(new Blob(['x'], { type: 'image/jpeg' }));
		expect(result).not.toBeNull();
		expect(result.pdfDataUrl).toBeTruthy();
		expect(MockJsPDF).toHaveBeenCalledWith(expect.objectContaining({ orientation: 'l' }));
	});

	test('uses portrait orientation when image height > width', async () => {
		setupImg(600, 800);
		const result = await handler(new Blob(['x'], { type: 'image/png' }));
		expect(result).not.toBeNull();
		expect(MockJsPDF).toHaveBeenCalledWith(expect.objectContaining({ orientation: 'p' }));
	});

	test('uses portrait orientation for square images', async () => {
		setupImg(500, 500);
		await handler(new Blob(['x'], { type: 'image/png' }));
		expect(MockJsPDF).toHaveBeenCalledWith(expect.objectContaining({ orientation: 'p' }));
	});

	test('returns null when image width exceeds MAX_PDF_DIMENSION', async () => {
		setupImg(MAX_PDF_DIMENSION + 1, 100);
		const result = await handler(new Blob(['x'], { type: 'image/jpeg' }));
		expect(result).toBeNull();
	});

	test('returns null when image height exceeds MAX_PDF_DIMENSION', async () => {
		setupImg(100, MAX_PDF_DIMENSION + 1);
		const result = await handler(new Blob(['x'], { type: 'image/jpeg' }));
		expect(result).toBeNull();
	});

	test('returns null for an unsupported image type (GIF)', async () => {
		setupImg(640, 480);
		const result = await handler(new Blob(['x'], { type: 'image/gif' }));
		expect(result).toBeNull();
	});

	test('returns null for an unsupported image type (SVG)', async () => {
		setupImg(640, 480);
		const result = await handler(new Blob(['<svg/>'], { type: 'image/svg+xml' }));
		expect(result).toBeNull();
	});

	test('returns null when the jsPDF library is not loaded', async () => {
		global.window = { jspdf: null, close: jest.fn() };
		const result = await handler(new Blob(['x'], { type: 'image/jpeg' }));
		expect(result).toBeNull();
	});

	test('returns null when the image fails to load', async () => {
		setupImg(100, 100, /* fail= */ true);
		const result = await handler(new Blob(['x'], { type: 'image/jpeg' }));
		expect(result).toBeNull();
	});

	test('passes image dimensions to jsPDF', async () => {
		setupImg(1024, 768);
		await handler(new Blob(['x'], { type: 'image/jpeg' }));
		expect(MockJsPDF).toHaveBeenCalledWith(
			expect.objectContaining({ format: [1024, 768], unit: 'px' })
		);
	});
});

// ── decodeBlobAsFormat handler ─────────────────────────────────────────────────

describe('decodeBlobAsFormat handler', () => {
	let handler;

	beforeEach(() => {
		handler = messageHandlers.get('decodeBlobAsFormat');
	});

	function setupCanvasAndImg(avifSupported = false) {
		const mockCanvas = makeMockCanvas(avifSupported);
		const mockImg = {
			src: '',
			naturalWidth: 100,
			naturalHeight: 100,
			decode: jest.fn().mockResolvedValue(undefined),
		};
		global.document.createElement = jest.fn((tag) => {
			if (tag === 'canvas') return mockCanvas;
			if (tag === 'img') return mockImg;
			return {};
		});
		return { mockCanvas, mockImg };
	}

	test('calls toDataURL with JPEG and quality 0.92 for jpg format', async () => {
		const { mockCanvas } = setupCanvasAndImg();
		await handler({ blob: new Blob(['x'], { type: 'image/jpeg' }), format: 'jpg' });
		expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.92);
	});

	test('calls toDataURL with WebP and quality 0.9 for webp format', async () => {
		const { mockCanvas } = setupCanvasAndImg();
		await handler({ blob: new Blob(['x'], { type: 'image/png' }), format: 'webp' });
		expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/webp', 0.9);
	});

	test('calls toDataURL with PNG for png format', async () => {
		const { mockCanvas } = setupCanvasAndImg();
		await handler({ blob: new Blob(['x'], { type: 'image/png' }), format: 'png' });
		expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/png');
	});

	test('calls toDataURL with AVIF when AVIF encoding is supported', async () => {
		const { mockCanvas } = setupCanvasAndImg(/* avifSupported= */ true);
		await handler({ blob: new Blob(['x']), format: 'avif' });
		expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/avif', 0.8);
	});

	test('falls back to PNG for avif format when AVIF is not supported', async () => {
		const { mockCanvas } = setupCanvasAndImg(/* avifSupported= */ false);
		await handler({ blob: new Blob(['x']), format: 'avif' });
		expect(mockCanvas.toDataURL).toHaveBeenLastCalledWith('image/png');
		expect(mockCanvas.toDataURL).not.toHaveBeenCalledWith('image/avif', 0.8);
	});

	test('returns null when image decode fails (corrupted image)', async () => {
		const mockImg = {
			src: '',
			naturalWidth: 0,
			naturalHeight: 0,
			decode: jest.fn().mockRejectedValue(new Error('Failed to decode image data')),
		};
		global.document.createElement = jest.fn((tag) =>
			tag === 'img' ? mockImg : makeMockCanvas()
		);
		const result = await handler({ blob: new Blob(['not-an-image']), format: 'png' });
		expect(result).toBeNull();
	});

	test('returns null when image decode fails for a zero-byte blob', async () => {
		const mockImg = {
			src: '',
			naturalWidth: 0,
			naturalHeight: 0,
			decode: jest.fn().mockRejectedValue(new Error('Empty source')),
		};
		global.document.createElement = jest.fn((tag) =>
			tag === 'img' ? mockImg : makeMockCanvas()
		);
		const result = await handler({ blob: new Blob([]), format: 'png' });
		expect(result).toBeNull();
	});

	test('returns an object with imageUrl on success', async () => {
		setupCanvasAndImg();
		const result = await handler({
			blob: new Blob(['x'], { type: 'image/png' }),
			format: 'png',
		});
		expect(result).not.toBeNull();
		expect(result.imageUrl).toMatch(/^data:/);
	});

	test('revokes the blob URL after processing', async () => {
		setupCanvasAndImg();
		await handler({ blob: new Blob(['x']), format: 'png' });
		expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake://test-blob');
	});
});

// ── createBlobURL handler ──────────────────────────────────────────────────────

describe('createBlobURL handler', () => {
	let handler;

	beforeEach(() => {
		handler = messageHandlers.get('createBlobURL');
	});

	test('returns a blobUrl on success', async () => {
		const blob = new Blob(['gif-data'], { type: 'image/gif' });
		const result = await handler(blob);
		expect(result).not.toBeNull();
		expect(result.blobUrl).toBe('blob:fake://test-blob');
		expect(global.URL.createObjectURL).toHaveBeenCalledWith(blob);
	});

	test('returns null when URL.createObjectURL throws', async () => {
		global.URL.createObjectURL = jest.fn().mockImplementation(() => {
			throw new Error('Quota exceeded');
		});
		const result = await handler(new Blob(['x']));
		expect(result).toBeNull();
	});
});
