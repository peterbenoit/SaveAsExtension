'use strict';

// Ensure Blob is available (Node 18+ has it globally; older versions do not)
if (typeof Blob === 'undefined') {
	const { Blob: NodeBlob } = require('buffer');
	global.Blob = NodeBlob;
}

// ── Chrome Extension API ───────────────────────────────────────────────────────
global.chrome = {
	runtime: {
		onInstalled: { addListener: jest.fn() },
		onStartup: { addListener: jest.fn() },
	},
	contextMenus: {
		removeAll: jest.fn(), // deliberately NOT calling the callback — prevents init chain
		create: jest.fn(),
		remove: jest.fn(),
		onClicked: { addListener: jest.fn() },
	},
	downloads: { download: jest.fn().mockResolvedValue(1) },
	scripting: { executeScript: jest.fn() },
	offscreen: { createDocument: jest.fn().mockResolvedValue(undefined) },
};

// ── OffscreenCanvas (default: returns PNG — simulates no AVIF support) ─────────
global.OffscreenCanvas = class MockOffscreenCanvas {
	constructor(w, h) {
		this.width = w;
		this.height = h;
	}
	getContext() {
		return { fillStyle: '', fillRect: jest.fn(), drawImage: jest.fn() };
	}
	convertToBlob(_opts = {}) {
		return Promise.resolve(new Blob(['fake'], { type: 'image/png' }));
	}
};

// ── createImageBitmap (default: resolves with a 100×100 bitmap) ────────────────
global.createImageBitmap = jest.fn().mockResolvedValue({ width: 100, height: 100 });

// ── FileReader ─────────────────────────────────────────────────────────────────
global.FileReader = class MockFileReader {
	readAsDataURL(_blob) {
		// Use a microtask so onloadend is set before we call it
		Promise.resolve().then(() => {
			this.result = 'data:image/png;base64,ZmFrZQ==';
			if (this.onloadend) this.onloadend();
		});
	}
};

// ── Service-worker globals ─────────────────────────────────────────────────────
global.self = {
	clients: { matchAll: jest.fn().mockResolvedValue([]) },
	addEventListener: jest.fn(),
};

// ── fetch (default: network failure) ──────────────────────────────────────────
global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

// ── crypto ─────────────────────────────────────────────────────────────────────
global.crypto = {
	randomUUID: jest.fn().mockReturnValue('00000000-0000-0000-0000-000000000001'),
};

// ── navigator (needed by offscreen.js) ────────────────────────────────────────
global.navigator = {
	serviceWorker: {
		onmessage: null, // offscreen.js will overwrite this
		controller: { postMessage: jest.fn() },
	},
};

// ── window (needed by offscreen.js) ───────────────────────────────────────────
global.window = {
	close: jest.fn(),
	jspdf: null,
};

// ── document (minimal; individual tests override createElement as needed) ──────
global.document = {
	createElement: jest.fn((tag) => {
		if (tag === 'canvas') {
			return {
				width: 0,
				height: 0,
				getContext: () => ({ drawImage: jest.fn() }),
				toDataURL: jest.fn((type) => `data:${type};base64,ZmFrZQ==`),
			};
		}
		if (tag === 'img') {
			return {
				src: '',
				naturalWidth: 100,
				naturalHeight: 100,
				decode: jest.fn().mockResolvedValue(undefined),
				onload: null,
				onerror: null,
			};
		}
		return {};
	}),
};

// ── URL static methods (needed by offscreen.js) ────────────────────────────────
global.URL.createObjectURL = jest.fn().mockReturnValue('blob:fake://test-blob');
global.URL.revokeObjectURL = jest.fn();

// ── alert (service workers can't call alert; offscreen.js provides it) ─────────
global.alert = jest.fn();
