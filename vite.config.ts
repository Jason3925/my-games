import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

/** 开发/预览时把 /demo、/demo.html 指到组件实验室入口。 */
function demoRoutePlugin(): Plugin {
  const rewrite = (url: string | undefined) => {
    if (!url) return url
    const path = url.split('?')[0]
    if (path === '/demo' || path === '/demo/' || path === '/demo.html') {
      const query = url.includes('?') ? url.slice(url.indexOf('?')) : ''
      return `/demo/index.html${query}`
    }
    return url
  }

  return {
    name: 'demo-route',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        req.url = rewrite(req.url) ?? req.url
        next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        req.url = rewrite(req.url) ?? req.url
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [demoRoutePlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        demo: resolve(rootDir, 'demo/index.html'),
      },
    },
  },
})
