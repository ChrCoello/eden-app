import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  base: "./",                          // relative URLs: works on GitHub Pages' /eden-app/ subpath
  server: { fs: { allow: [".."] } },   // garden.json & the scan live in ../data
  build: { chunkSizeWarningLimit: 800 }, // the Firebase SDK is most of the bundle (~190 kB gzipped)
  // `--mode fake`: in-memory backend for UI tests, no real Firestore
  resolve: mode === "fake"
    ? { alias: { "./firebase.js": fileURLToPath(new URL("src/firebase.fake.js", import.meta.url)) } }
    : {},
  test: { exclude: [...configDefaults.exclude, "rules/**"] },  // rules tests need the emulator
}));
