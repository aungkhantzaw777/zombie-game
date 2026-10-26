export class GameInput {
  private held = new Set<string>()
  private stick = { x: 0, y: 0 }
  private down = (event: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault()
    this.held.add(event.key.toLowerCase())
  }
  private up = (event: KeyboardEvent) => { this.held.delete(event.key.toLowerCase()) }
  private blur = () => this.clear()
  constructor() {
    window.addEventListener('keydown', this.down)
    window.addEventListener('keyup', this.up)
    window.addEventListener('blur', this.blur)
  }
  setStick(x: number, y: number): void { this.stick = { x, y } }
  clear(): void { this.held.clear(); this.stick = { x: 0, y: 0 } }
  vector(): { x: number; y: number } {
    let x = Number(this.held.has('d') || this.held.has('arrowright')) - Number(this.held.has('a') || this.held.has('arrowleft')) + this.stick.x
    let y = Number(this.held.has('s') || this.held.has('arrowdown')) - Number(this.held.has('w') || this.held.has('arrowup')) + this.stick.y
    const length = Math.hypot(x, y)
    if (length > 1) { x /= length; y /= length }
    return { x, y }
  }
  dispose(): void {
    window.removeEventListener('keydown', this.down)
    window.removeEventListener('keyup', this.up)
    window.removeEventListener('blur', this.blur)
  }
}
