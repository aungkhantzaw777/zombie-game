export const GAME = {
  width: 2400,
  height: 1600,
  duration: 300,
  bossTime: 240,
  playerRadius: 15,
  baseHp: 100,
  baseSpeed: 215,
  baseDamage: 22,
  baseFireInterval: 0.49,
  basePickupRadius: 56,
  bulletSpeed: 640,
  bulletLife: 0.95,
  attackRange: 510,
  enemyCap: 120,
  gemCap: 180,
} as const

export type EnemyKind = 'walker' | 'runner' | 'brute' | 'boss'

export const ENEMY = {
  walker: { hp: 42, speed: 54, radius: 17, damage: 11, xp: 8, color: 0x8cae59 },
  runner: { hp: 29, speed: 104, radius: 13, damage: 9, xp: 10, color: 0xb7d26d },
  brute: { hp: 145, speed: 37, radius: 26, damage: 21, xp: 22, color: 0x719b62 },
  boss: { hp: 2100, speed: 48, radius: 48, damage: 27, xp: 0, color: 0xc6d16c },
} as const
