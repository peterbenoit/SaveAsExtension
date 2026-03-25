# Save Image As...

A Chrome extension that adds format options to the browser right-click menu for images. Right-click any image and save it as PNG, JPG, WEBP, AVIF, GIF, or PDF.

## Usage

1. Right-click any image on a webpage.
2. Select "Save Image As..." from the context menu.
3. Choose a format from the submenu.
4. The browser download dialog will open with the converted file.

## Formats

| Format | Best for |
|--------|----------|
| PNG | Screenshots, graphics, images with transparency |
| JPG | Photos and images where file size matters |
| WEBP | Modern web use; good balance of quality and size |
| AVIF | Next-generation format with excellent compression (requires browser support) |
| GIF (static) | Static GIF export only; animation is not preserved during conversion |
| PDF | Single-page document containing the image, auto-oriented by dimensions |

## Notes

- **GIF**: The browser canvas API does not support encoding animated GIFs. Saving any image as GIF produces a static file regardless of whether the source was animated.
- **AVIF**: The AVIF menu option only appears if your browser supports AVIF encoding. It is hidden automatically at startup if support is not detected.
- **Cross-origin images**: The extension attempts to load images in the context of the current page first. If that fails, it falls back to a background fetch. Most public images work with either approach.
- **PDF dimensions**: Images larger than 16,000px in either dimension cannot be converted to PDF.

## Privacy

This extension does not collect any user data and does not communicate with external servers. It only requests the permissions required for image conversion and downloading.

## Browser Requirements

Chrome 109 or later is required.

## Credits

Originally based on [Save Image as PNG](https://chromewebstore.google.com/detail/save-image-as-png/) by Rob Wu. Extended to support multiple formats by Peter Benoit.

## Version History

- 1.1.0: Added PDF export; renamed GIF option to "GIF (static)" to clarify behavior; security and quality improvements
- 1.0.1: Added AVIF support with fallback mechanism
- 1.0.0: Initial release with PNG, JPG, and WEBP support

## License

MIT
