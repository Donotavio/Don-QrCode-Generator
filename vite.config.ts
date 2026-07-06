import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  // Base path para GitHub Pages project site.
  // Se futuramente usar domínio próprio, mude para '/'.
  base: '/Don-QrCode-Generator/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon-32.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Don QR Code',
        short_name: 'Don QR',
        description: 'Gerador pessoal de QR codes, hospedado no GitHub Pages.',
        lang: 'pt-BR',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f172a',
        theme_color: '#6366f1',
        icons: [
          { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Pré-cacheia o shell (JS/CSS/HTML/ícones). Não cacheia a API do Worker.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // HashRouter: só há uma URL real (index.html); não intercepta navegação.
        navigateFallback: null,
        runtimeCaching: [
          {
            // Avatares do GitHub (imutáveis por CDN).
            urlPattern: ({ url }) => url.hostname === 'avatars.githubusercontent.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'github-avatars',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
