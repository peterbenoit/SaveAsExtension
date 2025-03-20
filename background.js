/**
 * (c) 2013 - 2024 Rob Wu <rob@robwu.nl>
 * Modified by Peter Benoit (2025) <peterbenoit@gmail.com>
 **/

'use strict';

chrome.runtime.onInstalled.addListener(function () {
    createContextMenu().catch((err) =>
        console.error('Error in onInstalled createContextMenu:', err)
    );
});

chrome.runtime.onStartup.addListener(function () {
    createContextMenu().catch((err) => console.error('Error in onStartup createContextMenu:', err));
});

async function createContextMenu() {
    try {
        // First check AVIF support
        const avifSupported = await checkAvifEncodingSupport();

        // Then create the menu
        chrome.contextMenus.removeAll(function () {
            chrome.contextMenus.create({
                id: 'save_image_parent',
                title: 'Save Image As...',
                contexts: ['image'],
            });

            chrome.contextMenus.create({
                id: 'save_as_png',
                parentId: 'save_image_parent',
                title: 'PNG',
                contexts: ['image'],
            });

            chrome.contextMenus.create({
                id: 'save_as_jpg',
                parentId: 'save_image_parent',
                title: 'JPG',
                contexts: ['image'],
            });

            chrome.contextMenus.create({
                id: 'save_as_webp',
                parentId: 'save_image_parent',
                title: 'WEBP',
                contexts: ['image'],
            });

            // Only add AVIF if supported
            if (avifSupported) {
                chrome.contextMenus.create({
                    id: 'save_as_avif',
                    parentId: 'save_image_parent',
                    title: 'AVIF',
                    contexts: ['image'],
                });
            }
        });
    } catch (e) {
        console.error('Error creating context menu:', e);
        // If there's an error during AVIF check, create menu without AVIF option
        chrome.contextMenus.removeAll(function () {
            chrome.contextMenus.create({
                id: 'save_image_parent',
                title: 'Save Image As...',
                contexts: ['image'],
            });

            chrome.contextMenus.create({
                id: 'save_as_png',
                parentId: 'save_image_parent',
                title: 'PNG',
                contexts: ['image'],
            });

            chrome.contextMenus.create({
                id: 'save_as_jpg',
                parentId: 'save_image_parent',
                title: 'JPG',
                contexts: ['image'],
            });

            chrome.contextMenus.create({
                id: 'save_as_webp',
                parentId: 'save_image_parent',
                title: 'WEBP',
                contexts: ['image'],
            });
        });
    }
}
/**
 * Checks if the current environment supports encoding images in the AVIF format.
 *
 * This function creates a small test canvas, draws a red rectangle on it,
 * and attempts to convert the canvas content to a Blob in the AVIF format.
 *
 * @async
 * @function
 * @returns {Promise<boolean>} A promise that resolves to `true` if AVIF encoding is supported,
 *                             or `false` otherwise.
 * @throws {Error} Logs a warning to the console if an error occurs during the encoding process.
 */
async function checkAvifEncodingSupport() {
    try {
        // Create a small test canvas
        const canvas = new OffscreenCanvas(2, 2);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'red';
        ctx.fillRect(0, 0, 2, 2);

        try {
            // Try to get it as AVIF
            const blob = await canvas.convertToBlob({ type: 'image/avif' });

            // Some browsers might silently fall back to another format
            if (blob.type === 'image/avif') {
                return true;
            }
            console.warn('Browser returned incorrect MIME type for AVIF:', blob.type);
            return false;
        } catch (e) {
            console.warn('AVIF encoding threw an error:', e);
            return false;
        }
    } catch (e) {
        console.error('Error in AVIF support check:', e);
        return false; // Default to not supported if there's any error
    }
}

function getFileNameFromURL(url, extension) {
    var reURI = /^(?:([^:]+:)?\/\/[^/]+)?([^?#]*)(\?[^#]*)?(#.*)?$/;
    //            SCHEME      HOST         1.PATH  2.QUERY   3.REF
    // Pattern to get first matching NAME.ext
    var reFilename = /[^/?#=]+(?=\.[a-z0-9]{3,4}\b)/i;
    var splitURI = reURI.exec(url);
    var suggestedFilename =
        reFilename.exec(splitURI[1]) ||
        reFilename.exec(splitURI[2]) ||
        reFilename.exec(splitURI[3]);
    if (suggestedFilename) {
        suggestedFilename = suggestedFilename[0];
        if (suggestedFilename.indexOf('%') != -1) {
            // URL-encoded %2Fpath%2Fto%2Ffile.png should be file.png
            try {
                suggestedFilename = reFilename.exec(decodeURIComponent(suggestedFilename))[0];
            } catch (e) {
                // Possible (extremely rare) errors:
                // URIError "Malformed URI", e.g. for "%AA.png"
                // TypeError "null has no properties", e.g. for "%2F.png"
            }
            // The downloads API implementation is going to normalize anyway,
            // let's do it ourselves to emphasize that this happens.
            suggestedFilename = suggestedFilename.replaceAll('%', '_');
        }
        suggestedFilename += '.' + extension;
    }
    return suggestedFilename || 'image.' + extension;
}

chrome.contextMenus.onClicked.addListener(function (info, tab) {
    const format =
        info.menuItemId === 'save_as_png'
            ? 'png'
            : info.menuItemId === 'save_as_jpg'
            ? 'jpg'
            : info.menuItemId === 'save_as_webp'
            ? 'webp'
            : info.menuItemId === 'save_as_avif'
            ? 'avif'
            : null;

    if (format) {
        downloadImageForFrame(info.srcUrl, tab.id, tab.frameId, format);
    }
});

async function downloadImageForFrame(srcUrl, tabId, frameId, format) {
    let filename = getFileNameFromURL(srcUrl, format);

    // Try to fetch the image in the context of the frame first, because that
    // ensures that the image request is fetched from the same network/cache
    // partition, and otherwise at least having similar cookies.
    let { imageUrl, errorMessage, fallbackToNonScript } = await fetchImageInFrame(
        srcUrl,
        tabId,
        frameId,
        format
    );

    if (!imageUrl && fallbackToNonScript) {
        // Failed, fall back. This won't work for images that expect cookies
        // from the frame partition, but will work perfectly for public images.
        ({ imageUrl, errorMessage } = await fetchImage(srcUrl, format));
    }

    console.assert(imageUrl || errorMessage, 'Got imageUrl or errorMessage');
    if (imageUrl) {
        // Nice! We got the image!
        try {
            await download(imageUrl, filename);
            // All right, we can ignore error messages if any.
            return;
        } catch (e) {
            errorMessage = 'An error occurred while saving the image:' + e.message;
        }
    }
    if (!errorMessage) {
        // Done!
        return;
    }
    // Service workers don't support alert, so display it elsewhere.
    let alerted = await queryOffscreenClient('alert', errorMessage);
    if (alerted) {
        // Shown message, we're good.
        return;
    }
    // This is extremely unexpected - somehow the offscreen document cannot
    // display the error. Could happen if a future Chrome release drops the
    // offscreen tabs API and/or reason.
    try {
        // Fall back to displaying alert in the tab if we can somehow not display
        // the message through the offscreen document.
        let [{ result }] = await chrome.scripting.executeScript({
            target: { tabId },
            injectImmediately: true,
            func: function (errorMessage) {
                console.error(errorMessage);
                // Note: If the document has a CSP sandbox without allow-modals,
                // then the dialog does not appear. This is hopefully
                // sufficiently rare that we don't need to care about.
                alert(errorMessage);
                return true;
            },
            args: [errorMessage],
        });
        if (result) {
            return;
        }
    } catch (e) {
        // Ignore. Perhaps the tab closed.
    }
    console.error(errorMessage);
}

async function fetchImageInFrame(srcUrl, tabId, frameId, format) {
    let target = { tabId };
    if (frameId > 0) {
        target.frameIds = [frameId];
    }
    // func to execute with scripting.executeScript in the web page:
    async function func(url, format) {
        function convertImgToURL(img, format) {
            let canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            let ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            let imageUrl;
            if (format === 'jpg') {
                imageUrl = canvas.toDataURL('image/jpeg', 1.0);
            } else if (format === 'webp') {
                imageUrl = canvas.toDataURL('image/webp', 0.9);
            } else if (format === 'avif') {
                try {
                    // Check if the browser actually creates AVIF data
                    const testDataUrl = canvas.toDataURL('image/avif', 0.8);

                    // If it starts with the correct MIME type, we're good
                    if (testDataUrl.startsWith('data:image/avif')) {
                        imageUrl = testDataUrl;
                        console.info('Successfully converted to AVIF');
                    } else {
                        // The browser accepted the MIME type but returned something else
                        console.warn(
                            'Browser claimed to support AVIF but returned a different format'
                        );
                        throw new Error('AVIF encoding not actually supported');
                    }
                } catch (e) {
                    console.warn('AVIF format not supported, falling back to PNG:', e.message);
                    imageUrl = canvas.toDataURL('image/png');
                }
            } else {
                imageUrl = canvas.toDataURL('image/png');
            }

            console.info(`Successfully converted image to ${format.toUpperCase()}`);
            return imageUrl;
        }

        // Re-use image if we can to avoid loading it.
        for (let img of document.images) {
            if (img.src === url) {
                try {
                    await img.decode();
                    console.info('Found image in document');
                    // This works for if the image is same-origin, or if it is
                    // cross-origin and already has the crossOrigin attribute.
                    return { imageUrl: convertImgToURL(img, format) };
                } catch (e) {
                    // Cannot re-use image, whether due it being invalid, or
                    // due to the canvas being tainted.
                    console.info('Cannot decode image in document', e.message);
                }
            }
        }
        // Note: content scripts are unaffected by the page's image-src CSP.
        let img = document.createElement('img');
        img.src = url;
        try {
            await img.decode();
            console.info('Loaded and decoded new image');
        } catch (e) {
            console.info('Unable to load new image');
            // Cannot load image.
            return { errorMessage: e.message, fallbackToNonScript: false };
        }
        try {
            // This only works for same-origin images.
            return { imageUrl: convertImgToURL(img, format) };
        } catch (e) {
            // Canvas was tainted.
            console.info(`Unable to convert canvas to ${format.toUpperCase()}`);
            return { errorMessage: e.message, fallbackToNonScript: true };
        }
    }

    let imageUrl;
    let errorMessage;
    let fallbackToNonScript = false;
    try {
        // Note: error needs to be implemented: https://crbug.com/1271527
        let [{ result, error }] = await chrome.scripting.executeScript({
            target,
            injectImmediately: true,
            func,
            args: [srcUrl, format],
        });
        if (result?.imageUrl) {
            imageUrl = result.imageUrl;
        } else if (error) {
            errorMessage = error?.message || String(error);
            fallbackToNonScript = true;
        } else if (result?.errorMessage) {
            errorMessage = result.errorMessage;
            // If the image failed to load, it will also fail when retrying.
            // So do not bother.
            fallbackToNonScript = result.fallbackToNonScript;
        } else {
            errorMessage = 'An unexpected error occurred.';
            fallbackToNonScript = true;
        }
    } catch (e) {
        errorMessage = e.message;
        fallbackToNonScript = true;
    }
    if (errorMessage) {
        errorMessage = 'An error occurred while loading ' + srcUrl + ': ' + errorMessage;
    }
    return { imageUrl, errorMessage, fallbackToNonScript };
}

async function fetchImage(srcUrl, format) {
    let blob;
    try {
        let res = await fetch(srcUrl, { credentials: 'include' });
        blob = await res.blob();
    } catch (e) {
        return { errorMessage: 'Failed to load image from ' + srcUrl };
    }
    try {
        return await convertBlobToURL(blob, format);
    } catch (e) {
        console.log(`Failed to convert blob to ${format.toUpperCase()}`, e);
        // Perhaps the content is SVG, need to use <img> for decoding.
    }

    // Fall back to offscreen document...
    let response = await queryOffscreenClient('decodeBlobAsFormat', { blob, format });
    if (response) {
        console.log(`Decoded blob as ${format.toUpperCase()} via offscreen document`);
        return { imageUrl: response.imageUrl };
    }
    return { errorMessage: 'Failed to decode image from ' + srcUrl };
}

async function convertBlobToURL(blob, format) {
    // createImageBitmap could throw, e.g. for SVG: https://crbug.com/40269670
    let bm = await createImageBitmap(blob);
    let oc = new OffscreenCanvas(bm.width, bm.height);
    oc.getContext('2d').drawImage(bm, 0, 0, bm.width, bm.height);

    let mimeType;
    let quality;

    if (format === 'jpg') {
        mimeType = 'image/jpeg';
        quality = 1.0;
    } else if (format === 'webp') {
        mimeType = 'image/webp';
        quality = 0.9;
    } else if (format === 'avif') {
        // Check if AVIF encoding is actually supported
        if (await checkAvifEncodingSupport()) {
            mimeType = 'image/avif';
            quality = 0.8;
        } else {
            console.warn('AVIF encoding not supported in this browser, falling back to PNG');
            mimeType = 'image/png';
            quality = undefined;
        }
    } else {
        // png
        mimeType = 'image/png';
        quality = undefined;
    }

    try {
        let decodedBlob = await oc.convertToBlob({
            type: mimeType,
            quality: quality,
        });

        // Verify the MIME type of the resulting blob
        if (format === 'avif' && decodedBlob.type !== 'image/avif') {
            console.warn('Browser returned incorrect MIME type for AVIF, falling back to PNG');
            decodedBlob = await oc.convertToBlob({
                type: 'image/png',
            });
        }

        let fr = new FileReader();
        await new Promise((resolve) => {
            fr.onloadend = resolve;
            fr.readAsDataURL(decodedBlob);
        });
        return { imageUrl: fr.result };
    } catch (e) {
        // If the format caused an error, fall back to PNG
        console.warn(`Error converting to ${format}, falling back to PNG:`, e);
        let decodedBlob = await oc.convertToBlob({
            type: 'image/png',
        });

        let fr = new FileReader();
        await new Promise((resolve) => {
            fr.onloadend = resolve;
            fr.readAsDataURL(decodedBlob);
        });
        return { imageUrl: fr.result };
    }
}

async function download(url, filename) {
    try {
        await chrome.downloads.download({
            url,
            filename,
            saveAs: true,
        });
        return;
    } catch (e) {
        if (!e.message.includes('filename')) {
            throw e;
        }
        // Get extension from filename
        const extension = filename.split('.').pop() || 'png';
        // Invalid filename. Use a safe fallback instead of not saving anything.
        await chrome.downloads.download({
            url,
            filename: 'image.' + extension,
            saveAs: true,
        });
    }
}

async function ensureOffscreenClient() {
    async function getOffscreenClient() {
        const clients = await self.clients.matchAll();
        return clients.find((c) => c.url.includes('offscreen.html'));
    }
    let client = await getOffscreenClient();
    if (client) {
        return client;
    }
    try {
        // Note: the offscreen document is responsible for closing itself after
        // a period of inactivity with window.close(), so we won't call
        // chrome.offscreen.closeDocument().
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            // DOM_SCRAPING is the closest reason; we want to use an <img> to
            // decode the image, which is technically scraping DOM.
            reasons: ['DOM_SCRAPING'],
            justification: 'Converting an image to different formats',
        });
    } catch (e) {
        // Maybe the offscreen document was still loading?
        let client = await getOffscreenClient();
        if (client) {
            return client;
        }
        console.error('Unable to open offscreen document', e);
    }
    return await getOffscreenClient();
}

/**
 * @param {string} type
 * @param {*} data
 * @returns {*} The response. null if an error occurred.
 */
async function queryOffscreenClient(type, data) {
    const client = await ensureOffscreenClient();
    if (!client) {
        console.error('Cannot find offscreen document');
        return null;
    }
    const messageId = crypto.randomUUID();
    const responsePromise = new Promise((resolve) => {
        function listener(event) {
            if (event.origin === origin && event.data.messageId === messageId) {
                resolve(event.data.response);
                self.removeEventListener('message', listener);
            }
        }
        self.addEventListener('message', listener);
    });
    client.postMessage({ messageId, type, data });
    return responsePromise;
}
