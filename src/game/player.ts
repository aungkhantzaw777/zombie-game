import { GAME } from './config'
import type { UpgradeLevels } from './upgrades'

export interface Player { x: number; y: number; hp: number; maxHp: number; invulnerable: number; facing: number }
export const newPlayer = (): Player => ({ x: GAME.width / 2, y: GAME.height / 2, hp: GAME.baseHp, maxHp: GAME.baseHp, invulnerable: 0, facing: 0 })

export function movePlayer(player: Player, vector: { x: number; y: number }, speedLevel: number, dt: number): void {
  const speed = GAME.baseSpeed * (1 + speedLevel * 0.11)
  player.x = Math.max(29, Math.min(GAME.width - 29, player.x + vector.x * speed * dt))
  player.y = Math.max(29, Math.min(GAME.height - 29, player.y + vector.y * speed * dt))
}

export function applyHealthUpgrade(player: Player, levels: UpgradeLevels): void {
  player.maxHp = GAME.baseHp + levels.health * 20
  player.hp = Math.min(player.maxHp, player.hp + 25)
}
