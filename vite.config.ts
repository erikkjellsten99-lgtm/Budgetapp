import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relativa sökvägar i bygget, så att appen fungerar var den än läggs upp (t.ex. GitHub Pages).
  base: './',
  plugins: [react()],
});
