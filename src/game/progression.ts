import { GAME } from './config'

export function xpRequired(level: number): number {
  return Math.round(22 + (level - 1) * 15 + Math.pow(level - 1, 1.35) * 3)
}

export function difficulty(time: number): number {
  return 1 + Math.min(time, GAME.duration) / 80
}

export function spawnInterval(time: number): number {
  return Math.max(0.27, 1.18 - time / 410)
}

export function isVictory(time: number, bossSpawned: boolean, bossAlive: boolean, hp: number): boolean {
  return hp > 0 && time >= GAME.duration && bossSpawned && !bossAlive
}

export function formatTime(seconds: number): string {
  const total = Math.floor(seconds)
  return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`
}
