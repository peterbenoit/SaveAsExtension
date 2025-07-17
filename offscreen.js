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
	// The blob URL is created here and will be valid as long as the offscreen
	// document is alive. It should be revoked eventually, but for a single
	// download, this is acceptable. The service worker will use this URL
	// to initiate the download.
	return { blobUrl: URL.createObjectURL(blob) };
});

// PDF conversion handler
messageHandlers.set('convertToPDF', async function (data) {
	const { imageDataUrl } = data;
	try {
		const { jsPDF } = window.jspdf;
		const doc = new jsPDF();
		const img = document.createElement('img');
		img.src = imageDataUrl;
		await img.decode();

		const pageWidth = doc.internal.pageSize.getWidth();
		const pageHeight = doc.internal.pageSize.getHeight();

		let imgWidth = img.naturalWidth;
		let imgHeight = img.naturalHeight;

		const aspectRatio = imgWidth / imgHeight;

		if (imgWidth > pageWidth) {
			imgWidth = pageWidth;
			imgHeight = imgWidth / aspectRatio;
		}

		if (imgHeight > pageHeight) {
			imgHeight = pageHeight;
			imgWidth = imgHeight * aspectRatio;
		}

		const x = (pageWidth - imgWidth) / 2;
		const y = (pageHeight - imgHeight) / 2;

		doc.addImage(imageDataUrl, 'PNG', x, y, imgWidth, imgHeight);
		const pdfDataUrl = doc.output('datauristring');
		return { pdfDataUrl };
	} catch (e) {
		console.error('Error creating PDF with jsPDF:', e);
		return null;
	}
});
