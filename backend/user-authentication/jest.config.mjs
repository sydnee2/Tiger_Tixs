export default {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.cjs'],
  coveragePathIgnorePatterns: ['/node_modules/'],
  collectCoverageFrom: ['server.js', '!**/node_modules/**'],
};
