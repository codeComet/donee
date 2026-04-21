import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs'

function buildExtensionAssets(env) {
  return {
    name: 'build-extension-assets',
    writeBundle(opts) {
      const dir = opts.dir || 'dist'

      // Process background service worker — substitute env vars
      let bg = readFileSync('src/background/service-worker.js', 'utf-8')
      bg = bg
        .replace(/__SUPABASE_URL__/g, env.VITE_SUPABASE_URL || '')
        .replace(/__SUPABASE_ANON_KEY__/g, env.VITE_SUPABASE_ANON_KEY || '')
      writeFileSync(`${dir}/background.js`, bg)

      // Copy manifest
      copyFileSync('manifest.json', `${dir}/manifest.json`)

      // Copy icons
      const iconsDir = `${dir}/icons`
      if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true })
      for (const size of ['16', '48', '128']) {
        const src = `public/icons/icon${size}.png`
        if (existsSync(src)) copyFileSync(src, `${iconsDir}/icon${size}.png`)
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), buildExtensionAssets(env)],
    define: {
      'process.env': {},
    },
    base: './',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: resolve(__dirname, 'popup.html'),
        },
      },
    },
  }
})
