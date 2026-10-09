export const COLS = 10
export const ROWS = 20
export const COLORS = Object.freeze({ I: '#28d7ef', J: '#3668f8', L: '#ff992e', O: '#ffdb35', S: '#61d842', T: '#ad55ef', Z: '#f34e5b' })
export const SHAPES = Object.freeze({
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  J: [[1,0,0],[1,1,1],[0,0,0]],
  L: [[0,0,1],[1,1,1],[0,0,0]],
  O: [[1,1],[1,1]],
  S: [[0,1,1],[1,1,0],[0,0,0]],
  T: [[0,1,0],[1,1,1],[0,0,0]],
  Z: [[1,1,0],[0,1,1],[0,0,0]],
})

// Clockwise SRS wall kicks. Coordinates here use screen-positive Y (down).
const KICKS = [
  [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
]
const I_KICKS = [
  [[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
  [[0,0],[-1,0],[2,0],[-1,-2],[2,1]],
  [[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
  [[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
]
export const emptyBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null))
export const rotateMatrix = matrix => matrix[0].map((_, i) => matrix.map(row => row[i]).reverse())
export const confettiCount = lines => ({ 2: 36, 3: 64, 4: 100 })[lines] || 0

export function pieceCells(piece) {
  if (!piece) return []
  return piece.matrix.flatMap((row, dy) => row.flatMap((cell, dx) => cell ? [{ x: piece.x + dx, y: piece.y + dy, type: piece.type }] : []))
}

export class TetrisGame {
  constructor(random = Math.random) {
    this.random = random
    this.status = 'ready'
    this.board = emptyBoard()
    this.piece = null
    this.next = null
    this.score = 0
    this.lines = 0
    this.bag = []
    this.events = []
    this.clearedRows = []
    this.clearMs = 0
    this.fallMs = 0
    this.lockMs = 0
    this.lockResets = 0
    this.serial = 0
  }

  get level() { return 1 + Math.floor(this.lines / 10) }
  get gravity() { return Math.max(75, 850 * 0.81 ** (this.level - 1)) }
  get canAct() { return this.status === 'playing' && !!this.piece && !this.clearedRows.length }

  drawFromBag() {
    if (!this.bag.length) {
      this.bag = Object.keys(SHAPES)
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1))
        ;[this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]]
      }
    }
    return this.bag.pop()
  }

  start() {
    this.board = emptyBoard()
    this.score = 0
    this.lines = 0
    this.bag = []
    this.events = []
    this.clearedRows = []
    this.clearMs = 0
    this.status = 'playing'
    this.next = this.drawFromBag()
    this.spawn()
  }

  spawn() {
    const type = this.next
    this.next = this.drawFromBag()
    const matrix = SHAPES[type].map(row => [...row])
    this.piece = { type, matrix, x: Math.floor((COLS - matrix.length) / 2), y: 0, rotation: 0 }
    this.serial++
    this.fallMs = this.lockMs = this.lockResets = 0
    if (!this.fits(this.piece)) return this.finish()
    this.events.push({ type: 'spawn', next: this.next })
  }

  fits(piece) {
    return pieceCells(piece).every(({ x, y }) => x >= 0 && x < COLS && y >= -4 && y < ROWS && (y < 0 || !this.board[y][x]))
  }

  isGrounded() { return this.piece && !this.fits({ ...this.piece, y: this.piece.y + 1 }) }

  resetLock(wasGrounded) {
    if (wasGrounded && this.lockResets < 15) {
      this.lockMs = 0
      this.lockResets++
    }
  }

  move(direction) {
    if (!this.canAct || ![-1, 1].includes(direction)) return false
    const moved = { ...this.piece, x: this.piece.x + direction }
    if (!this.fits(moved)) return false
    const grounded = this.isGrounded()
    this.piece = moved
    this.resetLock(grounded)
    return true
  }

  rotate() {
    if (!this.canAct || this.piece.type === 'O') return false
    const p = this.piece
    const matrix = rotateMatrix(p.matrix)
    const grounded = this.isGrounded()
    for (const [dx, dy] of (p.type === 'I' ? I_KICKS : KICKS)[p.rotation]) {
      const rotated = { ...p, matrix, x: p.x + dx, y: p.y + dy, rotation: (p.rotation + 1) % 4 }
      if (this.fits(rotated)) {
        this.piece = rotated
        this.resetLock(grounded)
        return true
      }
    }
    return false
  }

  softDrop() {
    if (!this.canAct) return false
    const moved = { ...this.piece, y: this.piece.y + 1 }
    if (!this.fits(moved)) return false
    this.piece = moved
    this.score++
    this.fallMs = 0
    this.lockMs = 0
    return true
  }

  ghost() {
    if (!this.piece) return null
    const ghost = { ...this.piece }
    while (this.fits({ ...ghost, y: ghost.y + 1 })) ghost.y++
    return ghost
  }

  hardDrop() {
    if (!this.canAct) return false
    const dropped = this.ghost()
    this.score += (dropped.y - this.piece.y) * 2
    this.piece = dropped
    this.events.push({ type: 'drop' })
    this.lock()
    return true
  }

  lock() {
    if (!this.piece) return
    const cells = pieceCells(this.piece)
    if (cells.some(cell => cell.y < 0)) return this.finish()
    for (const cell of cells) this.board[cell.y][cell.x] = cell.type
    this.piece = null
    this.clearedRows = this.board.flatMap((row, index) => row.every(Boolean) ? [index] : [])
    if (this.clearedRows.length) {
      const count = this.clearedRows.length
      const points = [0, 100, 300, 500, 800][count] * this.level
      this.score += points
      this.lines += count
      this.clearMs = 180
      this.events.push({ type: 'clear', count, points })
    } else {
      this.spawn()
    }
  }

  step(delta) {
    if (this.status !== 'playing') return
    const dt = Math.min(Math.max(delta, 0), 100)
    if (this.clearedRows.length) {
      this.clearMs -= dt
      if (this.clearMs <= 0) {
        const remaining = this.board.filter((_, i) => !this.clearedRows.includes(i))
        this.board = [...Array.from({ length: this.clearedRows.length }, () => Array(COLS).fill(null)), ...remaining]
        this.clearedRows = []
        this.spawn()
      }
      return
    }
    if (!this.piece) return
    this.fallMs += dt
    while (this.fallMs >= this.gravity) {
      this.fallMs -= this.gravity
      const moved = { ...this.piece, y: this.piece.y + 1 }
      if (this.fits(moved)) this.piece = moved
    }
    if (this.isGrounded()) {
      this.lockMs += dt
      if (this.lockMs >= 500) this.lock()
    } else {
      this.lockMs = 0
    }
  }

  pause() { if (this.status === 'playing') this.status = 'paused' }
  resume() { if (this.status === 'paused') this.status = 'playing' }
  finish() { this.status = 'over'; this.events.push({ type: 'over', score: this.score }) }
  drainEvents() { return this.events.splice(0) }
}
