/** @type {import('jest').Config} */
module.exports = {
	testEnvironment: 'node',
	setupFiles: ['./tests/setup.js'],
	testMatch: ['**/tests/**/*.test.js'],
	collectCoverageFrom: ['background.js', 'offscreen.js'],
};
