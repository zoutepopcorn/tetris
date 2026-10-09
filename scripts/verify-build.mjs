import { readFile, readdir, stat } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
import assert from 'node:assert/strict'
import sharp from 'sharp'

const root = resolve('dist')
const html = await readFile(resolve(root,'index.html'),'utf8')
const sw = await readFile(resolve(root,'sw.js'),'utf8')
assert.ok(!sw.includes('__VERSION__') && !sw.includes('__PRECACHE__'),'SW-placeholders moeten vervangen zijn')
const precache = JSON.parse(sw.match(/const PRECACHE = (\[.*?\])\.map/)[1])
for (const file of precache) assert.ok((await stat(resolve(root,file))).isFile(),`Offline-bestand ontbreekt: ${file}`)
for (const [,file] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  assert.ok(!/^(https?:)?\/\//.test(file),`Onverwachte externe afhankelijkheid: ${file}`)
  assert.ok((await stat(resolve(root,file))).isFile(),`HTML-verwijzing ontbreekt: ${file}`)
  assert.ok(precache.includes(file),`HTML-bestand niet in offlinecache: ${file}`)
}
const manifest = JSON.parse(await readFile(resolve(root,'manifest.webmanifest'),'utf8'))
for (const icon of manifest.icons) {
  const data = await sharp(resolve(root,icon.src)).metadata()
  assert.equal(`${data.width}x${data.height}`,icon.sizes)
  assert.ok(precache.includes(`./${icon.src}`))
}
async function all(path) { return (await Promise.all((await readdir(path,{withFileTypes:true})).map(entry=>entry.isDirectory()?all(resolve(path,entry.name)):resolve(path,entry.name)))).flat() }
const files = await all(root)
for (const file of files) {
  const path = relative(root,file)
  if (!['sw.js','_headers'].includes(path)) assert.ok(precache.includes(`./${path}`),`Asset mist uit cache: ${path}`)
}
console.log(`PWA-build gecontroleerd: ${precache.length} offline-assets, alle HTML-verwijzingen, manifest en iconen geldig.`)
