import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  srcDir: 'app/',
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: [
    'nuxt-auth-utils',
    '@nuxt/icon',
    (_options, nuxt) => {
      nuxt.hook('nitro:config', (nitroConfig) => {
        const imports = nitroConfig.imports
        if (!imports?.dirs) return

        imports.dirs = imports.dirs.filter((dir) => !String(dir).includes('nuxt-auth-utils/dist/runtime/server/utils'))
      })
    },
  ],
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      ],
    },
  },
  runtimeConfig: {
    session: {
      password: process.env.NUXT_SESSION_PASSWORD || 'default-session-password-at-least-32-chars-long',
    },
    public: {
      siteName: process.env.SITE_NAME || 'Moo Tasks',
    },
  },
  nitro: {
    esbuild: {
      options: {
        target: 'es2019'
      }
    }
  },
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ['vuedraggable'],
    }
  },
})
