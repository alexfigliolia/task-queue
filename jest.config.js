module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  clearMocks: true,
  coverageProvider: "v8",
  testMatch: [
    "**/__tests__/**/*.[jt]s?(x)"
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/"
  ],
  setupFilesAfterEnv: ["jest-extended/all"],
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: -10,
    },
  },
};
