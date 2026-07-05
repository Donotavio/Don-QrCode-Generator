import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  // Base path para GitHub Pages project site.
  // Deve bater com o nome do repo no GitHub.
  // Se futuramente usar domínio próprio, mude para '/'.
  base: '/Don-QrCode-Generator/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
