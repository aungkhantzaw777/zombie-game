import { describe, expect, it } from 'vitest'
import { GAME } from './config'
import { difficulty, isVictory, spawnInterval, xpRequired } from './progression'
import { applyUpgrade, availableUpgrades, chooseUpgrades, initialUpgrades, UPGRADES } from './upgrades'
import { defaultBests, defaultSettings, updateBests, validateBests, validateSettings } from '../lib/persistence'
import { segmentHitsCircle } from './combat'
import { spawnPosition } from './spawning'

describe('progression and win condition', () => {
  it('scales XP and enemy pressure as the run progresses', () => {
    expect(xpRequired(2)).toBeGreaterThan(xpRequired(1))
    expect(difficulty(250)).toBeGreaterThan(difficulty(20))
    expect(spawnInterval(250)).toBeLessThan(spawnInterval(20))
  })
  it('requires both the five minute mark and a dead boss while alive', () => {
    expect(isVictory(GAME.duration - 1, true, false, 1)).toBe(false)
    expect(isVictory(GAME.duration, true, true, 1)).toBe(false)
    expect(isVictory(GAME.duration, false, false, 1)).toBe(false)
    expect(isVictory(GAME.duration, true, false, 0)).toBe(false)
    expect(isVictory(GAME.duration, true, false, 1)).toBe(true)
  })
})

describe('upgrades', () => {
  it('offers distinct available choices and enforces caps', () => {
    const levels = initialUpgrades()
    const choices = chooseUpgrades(levels, () => 0.5)
    expect(new Set(choices).size).toBe(3)
    levels.projectiles = UPGRADES.projectiles.cap
    expect(availableUpgrades(levels)).not.toContain('projectiles')
    expect(applyUpgrade(levels, 'projectiles')).toBe(levels)
  })
  it('offers healing when all upgrades are capped', () => {
    const levels = initialUpgrades()
    for (const id of Object.keys(levels) as Array<keyof typeof levels>) levels[id] = UPGRADES[id].cap
    expect(chooseUpgrades(levels)).toEqual(['recovery'])
  })
})

describe('combat and spawning geometry', () => {
  it('detects a fast bullet crossing an enemy between frames', () => {
    expect(segmentHitsCircle(0, 0, 100, 0, 50, 3, 5)).toBe(true)
    expect(segmentHitsCircle(0, 0, 100, 0, 50, 8, 5)).toBe(false)
  })
  it('spawns away from the centered camera view', () => {
    const player = { x: GAME.width / 2, y: GAME.height / 2 }
    const pos = spawnPosition(player, 900, 600, () => 0)
    expect(pos.x - player.x).toBeGreaterThan(900 / 2)
  })
})

describe('local data', () => {
  it('rejects corrupt values and clamps volume', () => {
    expect(validateSettings({ muted: 'yes', volume: 7, reducedMotion: 1 })).toEqual({ ...defaultSettings, volume: 1 })
    expect(validateBests({ longest: -3, mostKills: '100', highestLevel: 0, victories: Infinity })).toEqual(defaultBests)
  })
  it('keeps records across runs and counts victories', () => {
    const first = updateBests(defaultBests, { time: 201.9, kills: 83, level: 9, victory: false })
    const next = updateBests(first, { time: 301, kills: 70, level: 12, victory: true })
    expect(next).toEqual({ longest: 301, mostKills: 83, highestLevel: 12, victories: 1 })
  })
})
