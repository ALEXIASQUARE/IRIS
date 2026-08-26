import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Le serveur de dev Vite renvoie "Content-Type: text/html" sans charset —
// on le précise explicitement pour éviter tout souci d'accents côté client
// qui ne respecterait pas la balise <meta charset> du document.
function forceUtf8Charset(): Plugin {
  return {
    name: 'force-utf8-charset',
    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        const setHeader = res.setHeader.bind(res)
        res.setHeader = (name: string, value: number | string | readonly string[]) => {
          if (typeof name === 'string' && name.toLowerCase() === 'content-type' && typeof value === 'string' && value.startsWith('text/html')) {
            return setHeader(name, 'text/html; charset=utf-8')
          }
          return setHeader(name, value)
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), forceUtf8Charset()],
})
