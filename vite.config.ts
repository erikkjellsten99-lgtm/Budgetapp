import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Varje bygge får ett eget versionsnummer. Appen jämför sitt nummer med version.json på
// servern och laddar om sig själv när en ny version har publicerats.
const BUILD_ID = String(Date.now());

function versionFile(): Plugin {
  return {
    name: 'version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) });
    },
  };
}

export default defineConfig({
  // Relativa sökvägar i bygget, så att appen fungerar var den än läggs upp (t.ex. GitHub Pages).
  base: './',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [react(), versionFile()],
});
