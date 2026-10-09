import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const template = await readFile(new URL('../src/service-worker.js', import.meta.url),'utf8')
const assets = ['./index.html','./assets/app.js','./assets/app.css','./manifest.webmanifest']

async function worker() {
  const listeners = new Map(), stores = new Map()
  let claimed = false, fetched = 0, offline = false
  const network = async request => { fetched++; if (offline) throw new Error('offline'); return {body:`network:${typeof request === 'string' ? request : request.url}`} }
  const caches = {
    async open(key) {
      if (!stores.has(key)) stores.set(key,new Map())
      const map = stores.get(key)
      return {
        async addAll(urls) { for (const url of urls) map.set(url,await network(url)) },
        async match(request) { return map.get(typeof request === 'string' ? request : request.url) },
      }
    },
    async keys() { return [...stores.keys()] },
    async delete(key) { return stores.delete(key) },
  }
  const scope = {
    URL, caches, fetch:network,
    self: { location:{href:'https://example.test/game/sw.js'}, clients:{async claim(){claimed=true}}, addEventListener(type,handler){listeners.set(type,handler)} },
  }
  vm.runInNewContext(template.replace('__VERSION__','test-version').replace('__PRECACHE__',JSON.stringify(assets)),scope)
  async function dispatch(type) {
    let task
    listeners.get(type)({waitUntil(promise){task=promise}})
    await task
  }
  function request(url, mode = 'cors', method = 'GET') {
    let response
    listeners.get('fetch')({request:{url,mode,method},respondWith(promise){response=promise}})
    return response
  }
  return {stores,dispatch,request,setOffline(){offline=true},get fetched(){return fetched},get claimed(){return claimed}}
}

test('offline heropenen levert de volledige app uit de eigen cache', async () => {
  const sw = await worker()
  await sw.dispatch('install'); await sw.dispatch('activate')
  sw.setOffline()
  const calls = sw.fetched
  assert.equal((await sw.request('https://example.test/game/','navigate')).body,'network:https://example.test/game/index.html')
  assert.equal((await sw.request('https://example.test/game/?source=homescreen','navigate')).body,'network:https://example.test/game/index.html')
  for (const asset of assets) assert.ok((await sw.request(new URL(asset,'https://example.test/game/').href)).body)
  assert.equal(sw.fetched,calls)
  assert.equal(sw.claimed,true)
})

test('de offlinecache bewaart geen logins, API-verzoeken of externe data', async () => {
  const sw = await worker()
  await sw.dispatch('install')
  assert.equal(sw.request('https://example.test/game/login','navigate'),undefined)
  assert.equal(sw.request('https://example.test/game/api/scores'),undefined)
  assert.equal(sw.request('https://other.test/game/assets/app.js'),undefined)
  assert.equal(sw.request('https://example.test/game/','navigate','POST'),undefined)
  assert.equal(sw.request('https://example.test/elsewhere/','navigate'),undefined)
})

test('een update ruimt alleen oude caches van dit spel op', async () => {
  const sw = await worker()
  sw.stores.set('tetris-pocket-old',new Map())
  sw.stores.set('another-app-cache',new Map())
  await sw.dispatch('install'); await sw.dispatch('activate')
  assert.ok(sw.stores.has('tetris-pocket-test-version'))
  assert.ok(sw.stores.has('another-app-cache'))
  assert.ok(!sw.stores.has('tetris-pocket-old'))
  assert.ok(!/self\.skipWaiting\(/.test(template))
})

test('manifest gebruikt draagbare paden, fullscreen en volwaardige app-iconen', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'))
  assert.equal(manifest.display,'fullscreen')
  assert.ok(manifest.display_override.includes('standalone'))
  assert.equal(manifest.start_url,'./')
  assert.equal(manifest.scope,'./')
  for (const size of ['192x192','512x512']) assert.ok(manifest.icons.some(icon=>icon.sizes===size && icon.purpose==='any'))
  assert.ok(manifest.icons.some(icon=>icon.purpose==='maskable'))
  for (const icon of manifest.icons) assert.ok((await readFile(new URL(`../public/${icon.src}`,import.meta.url))).byteLength>0)
})
