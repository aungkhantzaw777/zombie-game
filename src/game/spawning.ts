import { GAME } from './config'

export function spawnPosition(player: { x: number; y: number }, visibleW: number, visibleH: number, random = Math.random): { x: number; y: number } {
  for (let tries = 0; tries < 20; tries++) {
    const angle = random() * Math.PI * 2
    const radius = Math.hypot(visibleW, visibleH) * 0.56 + 90
    const x = Math.max(40, Math.min(GAME.width - 40, player.x + Math.cos(angle) * radius))
    const y = Math.max(40, Math.min(GAME.height - 40, player.y + Math.sin(angle) * radius))
    if (Math.abs(x - player.x) > visibleW / 2 + 34 || Math.abs(y - player.y) > visibleH / 2 + 34) return { x, y }
  }
  const corners = [{ x: 42, y: 42 }, { x: GAME.width - 42, y: 42 }, { x: 42, y: GAME.height - 42 }, { x: GAME.width - 42, y: GAME.height - 42 }]
  return corners.sort((a, b) => Math.hypot(b.x - player.x, b.y - player.y) - Math.hypot(a.x - player.x, a.y - player.y))[0]
}
