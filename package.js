const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const EXTENSION_NAME = 'SaveAsExtension';
const PACKAGE_DIR = path.join(__dirname, 'package');
const ZIP_PATH = path.join(PACKAGE_DIR, `${EXTENSION_NAME}.zip`);

const INCLUDE = [
	'background.js',
	'manifest.json',
	'offscreen.html',
	'offscreen.js',
	'package.json',
	'img',
	'lib',
];

fs.mkdirSync(PACKAGE_DIR, { recursive: true });

if (fs.existsSync(ZIP_PATH)) {
	console.log(`Removing existing ${EXTENSION_NAME}.zip...`);
	fs.unlinkSync(ZIP_PATH);
}

console.log(`Creating ${EXTENSION_NAME}.zip in package folder...`);

// Use PowerShell on Windows, zip on Unix
if (process.platform === 'win32') {
	const items = INCLUDE.map(i => `'${i}'`).join(',');
	execSync(
		`powershell -NoProfile -Command "Compress-Archive -Path ${items} -DestinationPath '${ZIP_PATH}'"`,
		{ cwd: __dirname, stdio: 'inherit' }
	);
} else {
	const args = INCLUDE.map(i => `"${i}"`).join(' ');
	execSync(`zip -r "${ZIP_PATH}" ${args}`, { cwd: __dirname, stdio: 'inherit' });
}

const size = fs.statSync(ZIP_PATH).size;
console.log(`Package created successfully: ${ZIP_PATH} (${(size / 1024).toFixed(1)} KB)`);
