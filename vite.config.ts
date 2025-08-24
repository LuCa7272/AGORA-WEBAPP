// FILE: vite.config.ts

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from 'vite-plugin-pwa';

// --- CONFIGURAZIONE NGROK ---
// Inserisci qui il tuo dominio statico di ngrok
const ngrokDomain = "redfish-exact-reptile.ngrok-free.app";

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
        description: 'Una lista della spesa intelligente che ti aiuta a fare la spesa più velocemente.',
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
        // Dice a Workbox di servire sempre /index.html quando una richiesta
        // di navigazione (es. refresh) fallisce, essenziale per la PWA.
        navigateFallback: '/index.html',
        // Impedisce che le chiamate API vengano reindirizzate a index.html.
        navigateFallbackDenylist: [/^\/api/],
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
    // Rende il server accessibile sulla rete locale (es. da telefono)
    host: true,

    // --- CONFIGURAZIONE PER NGROK ---
    // Essenziale per far funzionare l'Hot Module Replacement (HMR)
    // attraverso il tunnel di ngrok.
    hmr: {
      host: ngrokDomain,
      protocol: 'wss',
    },
    // Aiuta Vite a riscrivere gli URL correttamente per il client
    origin: `https://${ngrokDomain}`,
    // --- FINE CONFIGURAZIONE NGROK ---
    
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});