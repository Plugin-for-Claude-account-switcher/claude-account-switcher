/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/src/test/**/*.test.ts'],
    moduleNameMapper: {
        // Redirect all imports of 'vscode' to our hand-crafted mock so tests
        // run without a real VS Code instance.
        '^vscode$': '<rootDir>/src/test/vscode.mock.ts',
    },
    clearMocks: true, // reset call counts between tests, keep implementations
};
