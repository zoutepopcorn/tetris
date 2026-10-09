<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { TetrisGame, SHAPES, COLORS } from './game/engine.js'
import { GestureController } from './game/gestures.js'
import { BoardRenderer, ConfettiRenderer } from './game/renderer.js'
import { readHighscore, saveHighscore, HIGHSCORE_KEY } from './game/storage.js'
import { registerGameTools } from './game/webmcp.js'

const game = new TetrisGame()
let storage
try { storage = window.localStorage } catch { /* Privémodus zonder opslag. */ }
const highscore = ref(readHighscore(storage))
const score = ref(0), lines = ref(0), level = ref(1), state = ref('ready')
const canvas = ref(null), confettiCanvas = ref(null), stage = ref(null)
const playButton = ref(null), resumeButton = ref(null), againButton = ref(null), pauseButton = ref(null)
const boardWidth = ref(320), nextType = ref('T'), nextVisible = ref(false), nextId = ref(0)
const storageWarning = ref(false), newRecord = ref(false)
let renderer, confetti, observer, raf, previous = 0, toastTimer, pointerId = null, recordAtStart = highscore.value
let cleanupTools = () => {}, wakeLock = null
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const format = value => new Intl.NumberFormat('nl-NL').format(value)
const preview = computed(() => {
  const matrix = SHAPES[nextType.value]
  const occupiedRows = matrix.filter(row => row.some(Boolean))
  const usedCols = matrix[0].map((_, x) => matrix.some(row => row[x])).flatMap((used, x) => used ? [x] : [])
  return occupiedRows.map(row => row.slice(Math.min(...usedCols), Math.max(...usedCols) + 1))
})

function sync() {
  const oldState = state.value
  score.value = game.score
  lines.value = game.lines
  level.value = game.level
  state.value = game.status
  if (game.score > highscore.value) {
    highscore.value = game.score
    if (!saveHighscore(storage, game.score)) storageWarning.value = true
  }
  for (const event of game.drainEvents()) {
    if (event.type === 'spawn') {
      nextType.value = event.next
      if (game.status === 'playing') announceNext()
    }
    if (event.type === 'clear') confetti?.burst(event.count, reducedMotion.matches)
    if (event.type === 'over') {
      newRecord.value = game.score > recordAtStart
      hideNext()
      releaseWakeLock()
    }
  }
  renderer?.render(game)
  if (oldState !== state.value) nextTick(() => {
    if (state.value === 'paused') resumeButton.value?.focus()
    if (state.value === 'over') againButton.value?.focus()
  })
}

function announceNext() {
  clearTimeout(toastTimer)
  nextId.value++
  nextVisible.value = true
  toastTimer = setTimeout(() => { nextVisible.value = false }, 1600)
}
function hideNext() { clearTimeout(toastTimer); nextVisible.value = false }
function act(action, arg) {
  if (game.status !== 'playing') return
  game[action](arg)
  sync()
}
const gestures = new GestureController({
  move: direction => act('move', direction), rotate: () => act('rotate'), drop: () => act('hardDrop'),
})

function enterFullscreen() {
  if (window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone) return
  if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {})
  }
}
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator && !document.hidden && !wakeLock) {
      const lock = await navigator.wakeLock.request('screen')
      if (game.status !== 'playing' || document.hidden) { await lock.release(); return }
      wakeLock = lock
      lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = null })
    }
  } catch { /* Niet elke browser ondersteunt dit. */ }
}
function releaseWakeLock() { const lock = wakeLock; wakeLock = null; lock?.release().catch(() => {}) }

function start() {
  if (game.status === 'playing' || game.status === 'paused') return
  enterFullscreen()
  recordAtStart = highscore.value
  newRecord.value = false
  gestures.cancel()
  confetti?.clear()
  game.start()
  previous = performance.now()
  sync()
  requestWakeLock()
  nextTick(() => pauseButton.value?.focus({ preventScroll: true }))
}
function pause() {
  game.pause()
  gestures.cancel()
  pointerId = null
  hideNext()
  confetti?.clear()
  releaseWakeLock()
  sync()
}
function resume() {
  enterFullscreen()
  game.resume()
  previous = performance.now()
  sync()
  announceNext()
  requestWakeLock()
  nextTick(() => pauseButton.value?.focus({ preventScroll: true }))
}

function pointerDown(event) {
  if (game.status !== 'playing' || event.target.closest('button') || pointerId !== null || !event.isPrimary) return
  if (event.pointerType === 'mouse' && event.button !== 0) return
  event.preventDefault()
  pointerId = event.pointerId
  event.currentTarget.setPointerCapture?.(event.pointerId)
  gestures.begin(event.clientX, event.clientY, boardWidth.value / 10, game.serial)
}
function pointerMove(event) {
  if (event.pointerId === pointerId) gestures.update(event.clientX, event.clientY, game.serial)
}
function pointerUp(event) {
  if (event.pointerId !== pointerId) return
  gestures.end(event.clientX, event.clientY, game.serial)
  pointerId = null
}
function pointerCancel() { gestures.cancel(); pointerId = null }

function keydown(event) {
  if (event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return
  if (event.code === 'Escape' || event.code === 'KeyP') {
    event.preventDefault()
    if (!event.repeat) state.value === 'playing' ? pause() : state.value === 'paused' ? resume() : null
    return
  }
  if (state.value !== 'playing') return
  const actions = { ArrowLeft: ['move', -1], ArrowRight: ['move', 1], ArrowDown: ['softDrop'], ArrowUp: ['rotate'], KeyX: ['rotate'], Space: ['hardDrop'] }
  const action = actions[event.code]
  if (action) {
    event.preventDefault()
    if (event.repeat && ['Space', 'ArrowUp', 'KeyX'].includes(event.code)) return
    act(...action)
  }
}
function visibility() { if (document.hidden && game.status === 'playing') pause() }
function blur() { if (game.status === 'playing') pause() }
function storageChanged(event) {
  if (event.key === HIGHSCORE_KEY) highscore.value = Math.max(highscore.value, readHighscore(storage))
}
function resize() {
  if (!stage.value || !renderer) return
  const box = stage.value.getBoundingClientRect()
  boardWidth.value = Math.max(60, Math.floor(Math.min(box.width - 2, (box.height - 2) / 2, 440)))
  renderer.resize(boardWidth.value, boardWidth.value * 2)
  renderer.render(game)
  confetti?.resize()
}
function frame(now) {
  const dt = previous ? Math.min(now - previous, 100) : 16
  previous = now
  if (game.status === 'playing') { game.step(dt); sync() }
  confetti?.draw(dt)
  raf = requestAnimationFrame(frame)
}

onMounted(() => {
  renderer = new BoardRenderer(canvas.value)
  confetti = new ConfettiRenderer(confettiCanvas.value)
  observer = new ResizeObserver(resize)
  observer.observe(stage.value)
  resize()
  raf = requestAnimationFrame(frame)
  window.addEventListener('keydown', keydown)
  window.addEventListener('blur', blur)
  window.addEventListener('storage', storageChanged)
  document.addEventListener('visibilitychange', visibility)
  cleanupTools = registerGameTools({ game, start, pause, resume, act, highscore: () => highscore.value, nextTick })
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  clearTimeout(toastTimer)
  observer?.disconnect()
  releaseWakeLock()
  cleanupTools()
  window.removeEventListener('keydown', keydown)
  window.removeEventListener('blur', blur)
  window.removeEventListener('storage', storageChanged)
  document.removeEventListener('visibilitychange', visibility)
})
</script>

<template>
  <main class="game-shell" :class="{ 'is-ready': state === 'ready' }" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="pointerCancel" @lostpointercapture="pointerCancel" @contextmenu.prevent>
    <header class="hud" :style="{ width: `${Math.max(boardWidth, 280)}px` }" :aria-hidden="state === 'ready'">
      <div class="score-group"><span class="eyebrow">SCORE</span><strong class="score" data-testid="score">{{ format(score) }}</strong></div>
      <div class="record-group"><span class="eyebrow"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m2 4 3 2 3-4 3 4 3-2-1 8H3Z"/><path d="M4 14h8"/></svg>RECORD</span><strong data-testid="highscore">{{ format(highscore) }}</strong></div>
      <button ref="pauseButton" class="pause-button" aria-label="Spel pauzeren" :disabled="state !== 'playing'" @pointerdown.stop @click="pause"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6v12M16 6v12"/></svg></button>
    </header>

    <div ref="stage" class="stage">
      <div class="playfield" :class="{ obscured: state === 'paused' || state === 'over' }" :style="{ width: `${boardWidth}px`, height: `${boardWidth * 2}px` }">
        <canvas ref="canvas" class="board" role="img" :aria-label="`Tetris-speelveld. Score ${score}, ${lines} lijnen, niveau ${level}.`">Tetris. Gebruik de pijltjes om te bewegen, omhoog om te draaien en spatie om te laten vallen.</canvas>
        <Transition name="toast">
          <aside v-if="nextVisible && state === 'playing'" :key="nextId" class="next-toast" aria-label="Volgend blokje">
            <span>HIERNA</span>
            <div class="mini-piece" :style="{ '--piece-color': COLORS[nextType], gridTemplateColumns: `repeat(${preview[0].length}, 12px)` }" role="img" :aria-label="`${nextType}-blok`">
              <template v-for="(row, y) in preview" :key="y"><i v-for="(cell, x) in row" :key="x" :class="{ filled: cell }" /></template>
            </div>
          </aside>
        </Transition>
      </div>
    </div>

    <Transition name="screen">
      <section v-if="state === 'ready'" class="overlay start-screen" aria-label="Tetris starten">
        <div class="start-content">
          <div class="brand-mark" aria-hidden="true"><i/><i/><i/><i/></div>
          <h1 class="wordmark" aria-label="Tetris"><span>T</span><span>E</span><span>T</span><span>R</span><span>I</span><span>S</span></h1>
          <div class="splash-record"><span>JOUW RECORD</span><strong>{{ format(highscore) }}</strong></div>
          <button ref="playButton" class="primary-button" @click="start"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg>Spelen</button>
          <div class="gesture-guide" aria-label="Besturing">
            <div><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="4"/><path d="M8 10a10 10 0 0 1 16 0M6 6v6h6M24 22a10 10 0 0 1-16 0m18 4v-6h-6"/></svg><b>Tik</b><span>Draaien</span></div>
            <div><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 16h22M10 11l-5 5 5 5m12-10 5 5-5 5"/></svg><b>Veeg opzij</b><span>Verplaatsen</span></div>
            <div><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 5v19m-6-6 6 6 6-6M7 28h18"/></svg><b>Veeg omlaag</b><span>Laten vallen</span></div>
          </div>
        </div>
      </section>
    </Transition>

    <Transition name="screen">
      <section v-if="state === 'paused'" class="overlay pause-screen" role="dialog" aria-modal="true" aria-labelledby="pause-title">
        <div class="dialog-content"><span class="dialog-kicker">EVEN RUST</span><h2 id="pause-title">Gepauzeerd</h2><button ref="resumeButton" class="primary-button" @click="resume"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg>Verder spelen</button></div>
      </section>
    </Transition>

    <Transition name="screen">
      <section v-if="state === 'over'" class="overlay over-screen" role="dialog" aria-modal="true" aria-labelledby="over-title">
        <div class="dialog-content">
          <span class="dialog-kicker" :class="{ 'new-record': newRecord }">{{ newRecord ? 'NIEUW RECORD' : 'GOED GESPEELD' }}</span>
          <h2 id="over-title">Game over.</h2>
          <strong class="final-score">{{ format(score) }}</strong><span class="final-score-label">PUNTEN</span>
          <div class="end-stats"><span>{{ lines }} lijnen</span><i/><span>Record {{ format(highscore) }}</span></div>
          <button ref="againButton" class="primary-button" @click="start">Nog een keer</button>
          <p v-if="storageWarning" class="storage-warning">Je browser kan je record niet bewaren. Sta lokale opslag toe om het te onthouden.</p>
        </div>
      </section>
    </Transition>
    <canvas ref="confettiCanvas" class="confetti" aria-hidden="true"/>
    <span class="sr-only" role="status" aria-live="polite">{{ state === 'over' ? `Game over. ${score} punten.` : state === 'paused' ? 'Gepauzeerd.' : '' }}</span>
  </main>
</template>
