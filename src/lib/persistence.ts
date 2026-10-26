export interface Settings { muted: boolean; volume: number; reducedMotion: boolean }
export interface Bests { longest: number; mostKills: number; highestLevel: number; victories: number }

export const defaultSettings: Settings = { muted: false, volume: 0.45, reducedMotion: false }
export const defaultBests: Bests = { longest: 0, mostKills: 0, highestLevel: 1, victories: 0 }

function read(key: string): unknown {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') } catch { return null }
}
function write(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Storage may be blocked. */ }
}
function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
function nonnegative(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback
}

export function validateSettings(value: unknown): Settings {
  const data = record(value)
  return {
    muted: typeof data.muted === 'boolean' ? data.muted : defaultSettings.muted,
    volume: typeof data.volume === 'number' && Number.isFinite(data.volume) ? Math.max(0, Math.min(1, data.volume)) : defaultSettings.volume,
    reducedMotion: typeof data.reducedMotion === 'boolean' ? data.reducedMotion : defaultSettings.reducedMotion,
  }
}
export function validateBests(value: unknown): Bests {
  const data = record(value)
  return {
    longest: nonnegative(data.longest, 0),
    mostKills: nonnegative(data.mostKills, 0),
    highestLevel: Math.max(1, nonnegative(data.highestLevel, 1)),
    victories: nonnegative(data.victories, 0),
  }
}
export function loadSettings(): Settings { return validateSettings(read('deadshift:settings')) }
export function saveSettings(value: Settings): void { write('deadshift:settings', validateSettings(value)) }
export function loadBests(): Bests { return validateBests(read('deadshift:bests')) }
export function saveBests(value: Bests): void { write('deadshift:bests', validateBests(value)) }
export function updateBests(old: Bests, result: { time: number; kills: number; level: number; victory: boolean }): Bests {
  return {
    longest: Math.max(old.longest, Math.floor(result.time)),
    mostKills: Math.max(old.mostKills, result.kills),
    highestLevel: Math.max(old.highestLevel, result.level),
    victories: old.victories + (result.victory ? 1 : 0),
  }
}
