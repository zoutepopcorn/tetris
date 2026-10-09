import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { writeFile, readFile, readdir } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
import { createHash } from 'node:crypto'

// Geen externe runtime of CDN: ieder benodigd bestand gaat in de offlinecache.
function offlinePwa() {
  let output
  return {
    name: 'tetris-offline-pwa',
    apply: 'build',
    configResolved(config) { output = resolve(config.root, config.build.outDir) },
    async closeBundle() {
      async function walk(path) {
        const entries = await readdir(path, { withFileTypes: true })
        return (await Promise.all(entries.map(entry => entry.isDirectory() ? walk(resolve(path, entry.name)) : resolve(path, entry.name)))).flat()
      }
      const files = (await walk(output)).filter(file => !['sw.js', '_headers'].includes(relative(output, file))).sort()
      const hash = createHash('sha256')
      for (const file of files) { hash.update(relative(output, file)); hash.update(await readFile(file)) }
      const precache = files.map(file => `./${relative(output, file).replaceAll('\\', '/')}`)
      const template = await readFile(new URL('./src/service-worker.js', import.meta.url), 'utf8')
      // Include the worker code in its own content version too.
      hash.update(template)
      const sw = template.replace('__PRECACHE__', JSON.stringify(precache)).replace('__VERSION__', hash.digest('hex').slice(0, 16))
      await writeFile(resolve(output, 'sw.js'), sw)
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [vue(), offlinePwa()],
  server: { host: '0.0.0.0', port: 4173, strictPort: true, allowedHosts: ['terminal.local'] },
  build: { target: 'es2020', sourcemap: false },
})
