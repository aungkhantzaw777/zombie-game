export type UpgradeId = 'damage' | 'fireRate' | 'speed' | 'health' | 'magnet' | 'projectiles' | 'recovery'
export type UpgradeLevels = Record<Exclude<UpgradeId, 'recovery'>, number>

export const UPGRADES: Record<UpgradeId, { name: string; description: string; cap: number; icon: string }> = {
  damage: { name: 'Hollow Points', description: '+25% bullet damage', cap: 5, icon: '✦' },
  fireRate: { name: 'Hair Trigger', description: '+18% firing speed', cap: 5, icon: '⌁' },
  speed: { name: 'Light Footed', description: '+11% movement speed', cap: 4, icon: '➜' },
  health: { name: 'Iron Will', description: '+20 maximum HP and heal 25', cap: 4, icon: '✚' },
  magnet: { name: 'Scrap Magnet', description: '+35 pickup radius', cap: 4, icon: '◇' },
  projectiles: { name: 'Split Shot', description: '+1 projectile, up to 4', cap: 3, icon: '✳' },
  recovery: { name: 'Field Dressing', description: 'Restore 35 HP', cap: Infinity, icon: '✚' },
}

export const initialUpgrades = (): UpgradeLevels => ({ damage: 0, fireRate: 0, speed: 0, health: 0, magnet: 0, projectiles: 0 })

export function availableUpgrades(levels: UpgradeLevels): UpgradeId[] {
  const available = (Object.keys(levels) as Array<keyof UpgradeLevels>).filter(id => levels[id] < UPGRADES[id].cap)
  return available.length ? available : ['recovery']
}

export function chooseUpgrades(levels: UpgradeLevels, random = Math.random): UpgradeId[] {
  const pool = availableUpgrades(levels)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, 3)
}

export function applyUpgrade(levels: UpgradeLevels, id: UpgradeId): UpgradeLevels {
  if (id === 'recovery' || levels[id] >= UPGRADES[id].cap) return levels
  return { ...levels, [id]: levels[id] + 1 }
}
