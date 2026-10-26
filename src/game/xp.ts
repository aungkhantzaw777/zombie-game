import { GAME } from './config'

export interface Gem { x: number; y: number; value: number; phase: number }
export const pickupRadius = (magnetLevel: number): number => GAME.basePickupRadius + magnetLevel * 35

export function pullGem(gem: Gem, player: { x: number; y: number }, radius: number, dt: number): void {
  const dx = player.x - gem.x, dy = player.y - gem.y
  const distance = Math.hypot(dx, dy)
  if (distance > 0 && distance < radius * 1.8) {
    const speed = 120 + (1 - distance / (radius * 1.8)) * 410
    gem.x += dx / distance * speed * dt
    gem.y += dy / distance * speed * dt
  }
}
