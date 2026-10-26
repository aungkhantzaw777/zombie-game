import { GAME } from './config'
import type { Enemy } from './enemies'

export interface Bullet { x: number; y: number; vx: number; vy: number; life: number; damage: number; active: boolean }

export function nearestEnemy(enemies: Enemy[], x: number, y: number, range: number = GAME.attackRange): Enemy | undefined {
  let target: Enemy | undefined
  let nearest = range
  for (const enemy of enemies) {
    const d = Math.hypot(enemy.x - x, enemy.y - y)
    if (d < nearest) { target = enemy; nearest = d }
  }
  return target
}

export function segmentHitsCircle(ax: number, ay: number, bx: number, by: number, px: number, py: number, radius: number): boolean {
  const dx = bx - ax, dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(ax + dx * t - px, ay + dy * t - py) <= radius
}
