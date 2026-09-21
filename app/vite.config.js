import { defineConfig } from "vite";

export default defineConfig({
  base: "./",                          // relative URLs: works on GitHub Pages' /eden-app/ subpath
  server: { fs: { allow: [".."] } },   // garden.json & the scan live in ../data
});
