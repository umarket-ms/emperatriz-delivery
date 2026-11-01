/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|react-native-reanimated|react-native-gesture-handler|@tanstack|react-hook-form|zod|nativewind|react-native-css-interop|react-native-paper|react-native-paper-dates)',
  ],
  setupFiles: ['./setupTests.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // Alias `@/` definido en tsconfig.json ("@/*": ["./*"]); Metro lo resuelve
  // solo, así que Jest necesita su equivalente para poder importar módulos
  // que usan el alias (p. ej. services/eventStreamService).
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/__tests__/**',
    'services/**/*.ts',
    'utils/**/*.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
