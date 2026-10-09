// A gesture controls only the piece that was active on pointerdown.
export class GestureController {
  constructor(actions) { this.actions = actions; this.cancel() }
  begin(x, y, cellSize, serial) {
    this.originX = this.lastX = x
    this.originY = y
    this.stepSize = Math.max(18, cellSize * 0.7)
    this.serial = serial
    this.maxDistance = 0
    this.axis = null
    this.active = true
  }
  update(x, y, serial) {
    if (!this.active || this.serial !== serial) return this.cancel()
    const dx = x - this.originX
    const dy = y - this.originY
    this.maxDistance = Math.max(this.maxDistance, Math.hypot(dx, dy))
    if (!this.axis && this.maxDistance > 10) this.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    if (this.axis === 'y' && dy > 38 && dy > Math.abs(dx) * 1.15) {
      this.actions.drop()
      this.cancel()
      return
    }
    if (this.axis === 'x') {
      while (Math.abs(x - this.lastX) >= this.stepSize) {
        const direction = x > this.lastX ? 1 : -1
        this.actions.move(direction)
        this.lastX += direction * this.stepSize
      }
    }
  }
  end(x, y, serial) {
    if (!this.active || this.serial !== serial) return this.cancel()
    this.update(x, y, serial)
    if (this.active && this.maxDistance <= 10) this.actions.rotate()
    this.cancel()
  }
  cancel() { this.active = false; this.axis = null }
}
