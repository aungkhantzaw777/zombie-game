import { ENEMY, type EnemyKind } from './config'
import { difficulty } from './progression'

export interface Enemy { x: number; y: number; kind: EnemyKind; hp: number; maxHp: number; hit: number; phase: number }

export function chooseEnemyKind(time: number, roll: number): Exclude<EnemyKind, 'boss'> {
  const bruteChance = Math.min(0.19, Math.max(0, time - 45) / 900)
  const runnerChance = Math.min(0.33, 0.10 + time / 1200)
  return roll < bruteChance ? 'brute' : roll < bruteChance + runnerChance ? 'runner' : 'walker'
}

export function enemyHealth(kind: Exclude<EnemyKind, 'boss'>, time: number): number {
  return Math.round(ENEMY[kind].hp * (1 + (difficulty(time) - 1) * 0.25))
}
