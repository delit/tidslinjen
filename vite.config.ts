import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

const PWA_ICON_SIZES = [
  '48x48',
  '72x72',
  '96x96',
  '128x128',
  '144x144',
  '152x152',
  '192x192',
  '256x256',
  '384x384',
  '512x512',
] as const;

function publicAsset(base: string, relativePath: string): string {
  return `${base}${relativePath}`.replace(/\/{2,}/g, '/');
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  /** Lokalt: /. GitHub Pages (delit.github.io/tidslinjen/): sätt VITE_BASE_PATH=/tidslinjen/ vid build. */
  const base = env.VITE_BASE_PATH || '/';

  const pwaManifestIcons = [
    ...PWA_ICON_SIZES.map((sizes) => ({
      src: publicAsset(base, `img/pwa/icons/icon-${sizes}.png`),
      sizes,
      type: 'image/png' as const,
      purpose: 'any' as const,
    })),
    {
      src: publicAsset(base, 'img/pwa/icons/icon-512x512.png'),
      sizes: '512x512',
      type: 'image/png' as const,
      purpose: 'maskable' as const,
    },
  ];

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false,
        includeAssets: [
          'img/favicon/favicon.ico',
          'img/favicon/favicon-16x16.png',
          'img/favicon/favicon-32x32.png',
          'img/favicon/apple-touch-icon.png',
          'img/favicon/android-chrome-192x192.png',
          'img/favicon/android-chrome-512x512.png',
          ...PWA_ICON_SIZES.map((s) => `img/pwa/icons/icon-${s}.png`),
        ],
        manifest: {
          name: 'Tidslinjen',
          short_name: 'Tidslinjen',
          description: 'Ordna händelser i rätt tid.',
          theme_color: '#0c1222',
          background_color: '#0c1222',
          display: 'standalone',
          orientation: 'portrait',
          start_url: base,
          scope: base,
          lang: 'sv',
          icons: pwaManifestIcons,
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
          navigateFallback: 'index.html',
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'google-fonts',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
            {
              urlPattern: ({request, url}) =>
                request.method === 'GET' &&
                (url.pathname.includes('/csv_2026/') || url.pathname.includes('/csv/')),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'csv-questions',
                networkTimeoutSeconds: 10,
                expiration: {
                  maxEntries: 40,
                  maxAgeSeconds: 60 * 60 * 24 * 14,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
        },
      }),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
