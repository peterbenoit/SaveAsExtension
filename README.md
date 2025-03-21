# Save Image As...

## Overview

This Chrome extension adds multiple image format options to the browser's context menu. It allows you to save images as PNG, JPG, WEBP, and AVIF (when supported by your browser).

## Features

-   Save any image directly in different formats (PNG, JPG, WEBP, AVIF)
-   Preserves image quality during format conversion
-   Works with almost any image on the web
-   Uses Chrome's built-in download manager
-   Smart fallback to PNG when a format isn't supported
-   Works in incognito mode

## Why Use This Extension?

Modern websites often serve images in WebP format for better performance, but some users prefer more traditional formats for compatibility with other applications. This extension lets you choose your preferred format when saving images.

## Usage

1. Right-click on any image on a webpage
2. Select "Save Image As..." from the context menu
3. Choose your preferred format (PNG, JPG, WEBP, or AVIF)
4. The browser's download dialog will appear with the converted image

## Format Information

-   **PNG**: Lossless format, best for graphics, screenshots, and images with text
-   **JPG**: Compressed format, best for photographs and complex images
-   **WEBP**: Modern format with good compression and quality
-   **AVIF**: Next-generation format with excellent compression (availability depends on browser support)

## Technical Details

-   Works with both same-origin and cross-origin images
-   Converts images using HTML Canvas API
-   Maintains original image dimensions
-   Falls back gracefully when certain formats aren't supported
-   Low memory footprint

## Browser Compatibility

Requires Chrome 106 or newer. The AVIF option will only appear if your browser supports AVIF encoding.

## Privacy

This extension:

-   Does not collect any user data
-   Does not communicate with external servers
-   Only requires permissions necessary for image conversion and downloading

## Credits

-   Originally based on [Save Image as PNG](https://chromewebstore.google.com/detail/save-image-as-png/) by Rob Wu
-   Modified to support multiple image formats

## Version History

-   1.0.0: Initial release with PNG, JPG and WEBP support
-   1.0.1: Added AVIF support with fallback mechanism

## Feedback and Contributions

If you encounter any issues or have suggestions for improvement, please leave feedback in the Chrome Web Store or contact the developers.

## License

This extension is provided under the MIT License.
