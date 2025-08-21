// FILE: vite.config.ts (CON FIX PWA E HMR MANTENUTO)

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: 'client',
  publicDir: 'public',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      manifest: {
        name: 'SmartCart - La Tua Lista della Spesa Intelligente',
        short_name: 'SmartCart',
        description: 'Una lista della spesa intelligente che ti aiuta a fare la spesa piÃ¹ velocemente.',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // --- QUESTA È LA MODIFICA CHIAVE PER LA ROBUSTEZZA OFFLINE ---
        // Dice a Workbox di servire sempre /index.html quando una richiesta
        // di navigazione (come un refresh di pagina) fallisce.
        navigateFallback: '/index.html',
        
        // Impedisce che le chiamate API vengano reindirizzate a index.html.
        navigateFallbackDenylist: [/^\/api/],
        // --- FINE DELLA MODIFICA CHIAVE ---
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
              networkTimeoutSeconds: 3,
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client/src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  
  build: {
    outDir: '../dist/public',
    emptyOutDir: true,
  },
  
  server: {
    // --- LA TUA CONFIGURazione HMR VIENE MANTENUTA ---
    
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});