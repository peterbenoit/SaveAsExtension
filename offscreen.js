/**
 * (c) 2013 - 2024 Rob Wu <rob@robwu.nl>
 * Original extension: https://chromewebstore.google.com/detail/save-image-as-png/
 * Modified by Peter Benoit (2025) <peterbenoit@gmail.com>
 **/

'use strict';

const KEEP_ALIVE_TIMEOUT_MS = 30_000;
let count = 0;
let timer;
function increaseKeepAliveCount() {
	++count;
	if (timer) {
		clearTimeout(timer);
		timer = null;
	}
}
function decreaseKeepAliveCount() {
	if (--count) {
		return;
	}
	// count dropped to zero, schedule close.
	timer = setTimeout(() => {
		window.close();
	}, KEEP_ALIVE_TIMEOUT_MS);
}

const messageHandlers = new Map();

navigator.serviceWorker.onmessage = async (ev) => {
	const handleMessage = messageHandlers.get(ev.data.type);
	let response;
	increaseKeepAliveCount();
	try {
		response = await handleMessage(ev.data.data);
	} catch (e) {
		response = null;
		console.error(e);
	}
	decreaseKeepAliveCount();
	navigator.serviceWorker.controller.postMessage({
		messageId: ev.data.messageId,
		response,
	});
};

messageHandlers.set('alert', async function (msg) {
	alert(msg);
	return true; // Signals that we handled the request to display the dialog.
});

messageHandlers.set('decodeBlobAsPNG', async function (blob) {
	const blobUrl = URL.createObjectURL(blob);
	try {
		const img = document.createElement('img');
		img.src = blobUrl;
		try {
			await img.decode();
		} catch (e) {
			console.info('Unable to decode image');
			return null; // The caller is not interested in the specific error.
		}
		const canvas = document.createElement('canvas');
		canvas.width = img.naturalWidth;
		canvas.height = img.naturalHeight;
		canvas.getContext('2d').drawImage(img, 0, 0);
		return { pngUrl: canvas.toDataURL('image/png') };
	} finally {
		URL.revokeObjectURL(blobUrl);
	}
});

// New handler for different formats
messageHandlers.set('decodeBlobAsFormat', async function (data) {
	const { blob, format } = data;
	const blobUrl = URL.createObjectURL(blob);
	try {
		const img = document.createElement('img');
		img.src = blobUrl;
		try {
			await img.decode();
		} catch (e) {
			console.info('Unable to decode image');
			return null; // The caller is not interested in the specific error.
		}
		const canvas = document.createElement('canvas');
		canvas.width = img.naturalWidth;
		canvas.height = img.naturalHeight;
		canvas.getContext('2d').drawImage(img, 0, 0);

		let imageUrl;
		if (format === 'jpg') {
			imageUrl = canvas.toDataURL('image/jpeg', 1.0);
		} else if (format === 'webp') {
			imageUrl = canvas.toDataURL('image/webp', 0.9);
		} else if (format === 'avif') {
			try {
				// Test AVIF support
				const testDataUrl = canvas.toDataURL('image/avif', 0.8);
				if (testDataUrl.startsWith('data:image/avif')) {
					// AVIF is properly supported
					imageUrl = testDataUrl;
				} else {
					console.warn('Browser silently converted AVIF to another format');
					imageUrl = canvas.toDataURL('image/png');
				}
			} catch (e) {
				console.warn(
					'AVIF format not supported in offscreen document, falling back to PNG:',
					e
				);
				imageUrl = canvas.toDataURL('image/png');
			}
		} else {
			imageUrl = canvas.toDataURL('image/png');
		}

		return { imageUrl };
	} finally {
		URL.revokeObjectURL(blobUrl);
	}
});

// New handler for creating a blob URL without conversion
messageHandlers.set('createBlobURL', async function (blob) {
	console.log(`[OFFSCREEN] Received blob for URL creation: ${blob.size} bytes, type: ${blob.type}`);
	try {
		const blobUrl = URL.createObjectURL(blob);
		console.log(`[OFFSCREEN] Created blob URL: ${blobUrl.slice(0, 100)}...`);
		// Note: This URL is intentionally not revoked immediately.
		// It will be valid until the offscreen document is closed.
		return { blobUrl };
	} catch (e) {
		console.error('[OFFSCREEN] Error creating blob URL:', e);
		return null;
	}
});

// PDF conversion handler
messageHandlers.set('createPDFFromBlob', async function (blob) {
	console.log(`[OFFSCREEN] Received blob for PDF creation: ${blob.size} bytes, type: ${blob.type}`);
	const blobUrl = URL.createObjectURL(blob);
	try {
		if (!window.jspdf || !window.jspdf.jsPDF) {
			console.error('[OFFSCREEN] jsPDF library not found on window object.');
			throw new Error('jsPDF library not loaded.');
		}
		console.log('[OFFSCREEN] jsPDF library loaded.');
		const { jsPDF } = window.jspdf;
		const img = document.createElement('img');

		console.log('[OFFSCREEN] Waiting for image to load...');
		await new Promise((resolve, reject) => {
			img.onload = () => {
				console.log('[OFFSCREEN] Image onload event fired.');
				resolve();
			};
			img.onerror = (err) => {
				console.error('[OFFSCREEN] Image onerror event fired:', err);
				reject(new Error('Image failed to load from blob URL.'));
			};
			img.src = blobUrl;
		});
		console.log(`[OFFSCREEN] Image loaded: ${img.naturalWidth}x${img.naturalHeight}`);

		const imageType = blob.type.split('/')[1]?.toUpperCase();
		const supportedFormats = ['JPEG', 'JPG', 'PNG', 'WEBP'];
		console.log(`[OFFSCREEN] Detected image type: ${imageType}`);
		if (!imageType || !supportedFormats.includes(imageType)) {
			throw new Error(`Unsupported image type for PDF conversion: ${blob.type}`);
		}

		const orientation = img.naturalWidth > img.naturalHeight ? 'l' : 'p';
		console.log(`[OFFSCREEN] Creating PDF with orientation: ${orientation}`);
		const doc = new jsPDF({
			orientation: orientation,
			unit: 'px',
			format: [img.naturalWidth, img.naturalHeight],
		});

		console.log('[OFFSCREEN] Adding image to PDF document...');
		doc.addImage(img, imageType, 0, 0, img.naturalWidth, img.naturalHeight);
		console.log('[OFFSCREEN] Generating PDF data URL...');
		const pdfDataUrl = doc.output('datauristring');
		console.log(`[OFFSCREEN] PDF Data URL created (length: ${pdfDataUrl.length}). Returning to background script.`);
		return { pdfDataUrl };
	} catch (e) {
		console.error('[OFFSCREEN] Error creating PDF with jsPDF:', e);
		return null;
	} finally {
		console.log(`[OFFSCREEN] Revoking blob URL: ${blobUrl.slice(0, 100)}...`);
		URL.revokeObjectURL(blobUrl);
	}
});
