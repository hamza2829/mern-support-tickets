module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.ts"],
  testTimeout: 120000,
  clearMocks: true,
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      { tsconfig: { rootDir: ".", types: ["jest", "node"] } },
    ],
  },
};
