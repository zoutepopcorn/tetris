import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
const output = new URL('../public/icons/', import.meta.url)
await mkdir(output, { recursive: true })

// Geometrisch T-tetromino als app-icoon; geen externe afbeeldingen nodig.
function icon(maskable) {
  const size = maskable ? 93 : 112, gap = 8
  const x = (512 - size * 3 - gap * 2) / 2, y = (512 - size * 2 - gap) / 2
  const blocks = [[1, 0], [0, 1], [1, 1], [2, 1]].map(([col, row]) => {
    const bx = x + col * (size + gap), by = y + row * (size + gap)
    return `<rect x="${bx}" y="${by}" width="${size}" height="${size}" fill="#ad55ef"/><path d="M${bx},${by+size}v-${size}h${size}" fill="none" stroke="#d598ff" stroke-width="8"/><path d="M${bx},${by+size}h${size}v-${size}" fill="none" stroke="#7436a5" stroke-width="8"/>`
  }).join('')
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#080c14"/>${blocks}</svg>`)
}
for (const size of [192, 512]) await sharp(icon(false)).resize(size, size).png().toFile(new URL(`icon-${size}.png`, output).pathname)
await sharp(icon(true)).png().toFile(new URL('maskable-512.png', output).pathname)
await sharp(icon(false)).resize(180, 180).png().toFile(new URL('apple-touch-icon.png', output).pathname)

const devices = [
  [320,568,2],[375,667,2],[414,736,3],[375,812,3],[390,844,3],[393,852,3],[402,874,3],[414,896,2],[414,896,3],[428,926,3],[430,932,3],[440,956,3],
  [768,1024,2],[820,1180,2],[834,1194,2],[1024,1366,2],
]
const links = []
for (const [w,h,dpr] of devices) {
  const width = w * dpr, height = h * dpr
  const logo = await sharp(icon(false)).resize(104*dpr,104*dpr).png().toBuffer()
  const path = `splash-${width}x${height}.png`
  await sharp({create:{width,height,channels:3,background:'#080c14'}}).composite([{input:logo,left:Math.round((width-104*dpr)/2),top:Math.round((height-104*dpr)/2)}]).png().toFile(new URL(path,output).pathname)
  links.push(`    <link rel="apple-touch-startup-image" href="./icons/${path}" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)" />`)
}
const { readFile } = await import('node:fs/promises')
const htmlPath = new URL('../index.html', import.meta.url)
let html = await readFile(htmlPath,'utf8')
html = html.replace(/\n    <!-- ios-splash:start -->[\s\S]*?<!-- ios-splash:end -->/,'')
html = html.replace('    <title>', `    <!-- ios-splash:start -->\n${links.join('\n')}\n    <!-- ios-splash:end -->\n    <title>`)
await writeFile(htmlPath,html)
console.log('App-iconen en iOS-opstartschermen aangemaakt.')
