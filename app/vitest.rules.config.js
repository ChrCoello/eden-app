import { defineConfig } from "vitest/config";

// Security rules tests, run inside the Firestore emulator: npm run test:rules
export default defineConfig({ test: { include: ["rules/**/*.test.js"] } });
