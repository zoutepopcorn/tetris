import { COLS, ROWS, COLORS, pieceCells, confettiCount } from './engine.js'

export class BoardRenderer {
  constructor(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.signature = '' }
  resize(width, height) {
    this.width = width
    this.height = height
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = Math.round(width * dpr)
    this.canvas.height = Math.round(height * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.signature = ''
  }
  block(x, y, color, ghost = false) {
    if (y < 0) return
    const ctx = this.ctx
    const s = this.width / COLS
    const px = x * s + 1.25, py = y * s + 1.25, w = s - 2.5
    if (ghost) {
      ctx.globalAlpha = 0.13
      ctx.fillStyle = color
      ctx.fillRect(px, py, w, w)
      ctx.globalAlpha = 0.45
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.strokeRect(px + 0.5, py + 0.5, w - 1, w - 1)
      ctx.globalAlpha = 1
      return
    }
    ctx.fillStyle = color
    ctx.fillRect(px, py, w, w)
    const bevel = Math.max(2, s * 0.095)
    ctx.fillStyle = 'rgba(255,255,255,.28)'
    ctx.fillRect(px, py, w, bevel)
    ctx.fillRect(px, py, bevel, w)
    ctx.fillStyle = 'rgba(0,0,0,.23)'
    ctx.fillRect(px, py + w - bevel, w, bevel)
    ctx.fillRect(px + w - bevel, py, bevel, w)
    ctx.strokeStyle = 'rgba(255,255,255,.12)'
    ctx.lineWidth = 1
    ctx.strokeRect(px + bevel + 1, py + bevel + 1, w - 2 * bevel - 2, w - 2 * bevel - 2)
  }
  render(game) {
    if (!this.width) return
    const p = game.piece
    const signature = `${game.board.flat().join(',')}|${p?.type},${p?.x},${p?.y},${p?.rotation}|${game.clearedRows.join(',')}`
    if (this.signature === signature) return
    this.signature = signature
    const ctx = this.ctx, s = this.width / COLS
    ctx.clearRect(0, 0, this.width, this.height)
    ctx.fillStyle = '#0a101b'
    ctx.fillRect(0, 0, this.width, this.height)
    ctx.strokeStyle = '#131d2c'
    ctx.lineWidth = 0.65
    ctx.beginPath()
    for (let x = 1; x < COLS; x++) { ctx.moveTo(x * s, 0); ctx.lineTo(x * s, this.height) }
    for (let y = 1; y < ROWS; y++) { ctx.moveTo(0, y * s); ctx.lineTo(this.width, y * s) }
    ctx.stroke()
    game.board.forEach((row, y) => row.forEach((cell, x) => { if (cell) this.block(x, y, COLORS[cell]) }))
    if (p) {
      const ghost = game.ghost()
      if (ghost && ghost.y !== p.y) pieceCells(ghost).forEach(c => this.block(c.x, c.y, COLORS[c.type], true))
      pieceCells(p).forEach(c => this.block(c.x, c.y, COLORS[c.type]))
    }
    for (const y of game.clearedRows) {
      ctx.fillStyle = 'rgba(255,255,255,.72)'
      ctx.fillRect(0, y * s, this.width, s)
    }
  }
}

export class ConfettiRenderer {
  constructor(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.particles = [] }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.width = this.canvas.clientWidth
    this.height = this.canvas.clientHeight
    this.canvas.width = Math.round(this.width * dpr)
    this.canvas.height = Math.round(this.height * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  burst(lines, reduced = false) {
    const count = confettiCount(lines)
    if (!count) return
    const palette = Object.values(COLORS)
    this.particles = []
    for (let i = 0; i < (reduced ? Math.min(12, count) : count); i++) {
      const side = i % 2
      this.particles.push({
        x: this.width * (side ? 0.86 : 0.14), y: this.height * 0.72,
        vx: (side ? -1 : 1) * (80 + Math.random() * 240), vy: -(150 + Math.random() * 270),
        rotation: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 14,
        age: 0, life: reduced ? 360 : 650 + lines * 95 + Math.random() * 100,
        size: 3 + Math.random() * 4, color: palette[i % palette.length], reduced,
      })
    }
  }
  draw(delta) {
    if (!this.particles.length) return
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)
    const dt = Math.min(delta, 50) / 1000
    this.particles = this.particles.filter(p => p.age < p.life)
    for (const p of this.particles) {
      p.age += delta
      p.x += p.vx * dt * (p.reduced ? 0.2 : 1)
      p.y += p.vy * dt * (p.reduced ? 0.2 : 1)
      p.vy += 720 * dt
      p.rotation += p.spin * dt
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)
      ctx.globalAlpha = Math.max(0, Math.min(1, (p.life - p.age) / 250))
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
      ctx.restore()
    }
  }
  clear() { this.particles = []; this.ctx.clearRect(0, 0, this.width, this.height) }
}
