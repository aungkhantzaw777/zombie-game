import Phaser from 'phaser'
import { ENEMY, GAME } from './config'
import { isVictory, spawnInterval, xpRequired } from './progression'
import { applyUpgrade, chooseUpgrades, initialUpgrades, type UpgradeId, type UpgradeLevels } from './upgrades'
import { GameInput } from './input'
import { newPlayer, movePlayer, applyHealthUpgrade } from './player'
import { chooseEnemyKind, enemyHealth, type Enemy } from './enemies'
import { nearestEnemy, segmentHitsCircle, type Bullet } from './combat'
import { spawnPosition } from './spawning'
import { pickupRadius, pullGem, type Gem } from './xp'
import type { AudioEngine } from './audio'
import type { Settings } from '../lib/persistence'

export interface HudState { hp: number; maxHp: number; xp: number; xpNeed: number; level: number; time: number; kills: number; bossHp: number; bossMaxHp: number }
export interface RunResult { victory: boolean; time: number; kills: number; level: number }
export interface SceneBridge {
  hud: (value: HudState) => void
  upgrade: (choices: UpgradeId[], levels: UpgradeLevels) => void
  resume: () => void
  finish: (result: RunResult) => void
}
type Effect = { x: number; y: number; life: number; maxLife: number; color: number; radius: number; vx: number; vy: number }

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
const distance = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by)

export class DeadshiftScene extends Phaser.Scene {
  private bridge: SceneBridge
  private audio: AudioEngine
  private settings: Settings
  private inputControl: GameInput | null = null
  private ground!: Phaser.GameObjects.Graphics
  private draw!: Phaser.GameObjects.Graphics
  private fx!: Phaser.GameObjects.Graphics
  private player = newPlayer()
  private enemies: Enemy[] = []
  private bullets: Bullet[] = []
  private bulletPool: Bullet[] = []
  private gems: Gem[] = []
  private effects: Effect[] = []
  private levels = initialUpgrades()
  private level = 1
  private xp = 0
  private elapsed = 0
  private kills = 0
  private spawnClock = 0
  private fireClock = 0
  private hudClock = 0
  private bossSpawned = false
  private bossState: 'idle' | 'warning' | 'dash' = 'idle'
  private bossClock = 4
  private bossVector = { x: 0, y: 0 }
  private mode: 'running' | 'pause' | 'upgrade' | 'ended' = 'running'
  private resizeHandler = () => this.resizeCamera()

  constructor(bridge: SceneBridge, audio: AudioEngine, settings: Settings) {
    super({ key: 'Deadshift' })
    this.bridge = bridge
    this.audio = audio
    this.settings = settings
  }

  create(): void {
    this.inputControl = new GameInput()
    this.ground = this.add.graphics().setDepth(-10)
    this.draw = this.add.graphics().setDepth(2)
    this.fx = this.add.graphics().setDepth(4)
    this.paintGround()
    this.cameras.main.setBounds(0, 0, GAME.width, GAME.height)
    this.resizeCamera()
    this.scale.on('resize', this.resizeHandler)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.dispose())
    this.emitHud()
  }

  dispose(): void {
    this.scale?.off('resize', this.resizeHandler)
    this.inputControl?.dispose()
    this.inputControl = null
  }

  setSettings(settings: Settings): void { this.settings = settings }
  setStick(x: number, y: number): void { this.inputControl?.setStick(x, y) }
  clearInput(): void { this.inputControl?.clear() }
  pauseRun(): void { if (this.mode === 'running') { this.mode = 'pause'; this.clearInput() } }
  resumeRun(): void { if (this.mode === 'pause') { this.mode = 'running'; this.clearInput() } }
  choose(id: UpgradeId): void {
    if (this.mode !== 'upgrade') return
    // React only displays offered upgrades; this also rejects stale UI commands.
    if (!this.offered.includes(id)) return
    this.levels = applyUpgrade(this.levels, id)
    if (id === 'health') applyHealthUpgrade(this.player, this.levels)
    if (id === 'recovery') this.player.hp = Math.min(this.player.maxHp, this.player.hp + 35)
    this.offered = []
    this.mode = 'running'
    this.clearInput()
    this.emitHud()
    this.checkLevel()
    if (this.mode === 'running') this.bridge.resume()
  }
  private offered: UpgradeId[] = []

  update(_time: number, deltaMs: number): void {
    if (this.mode !== 'running') return
    const dt = Math.min(deltaMs / 1000, 0.05)
    this.elapsed += dt
    this.player.invulnerable = Math.max(0, this.player.invulnerable - dt)
    this.movePlayer(dt)
    this.spawnClock += dt
    if (this.spawnClock >= spawnInterval(this.elapsed)) {
      this.spawnClock = 0
      const count = this.elapsed > 180 ? 2 : 1
      for (let i = 0; i < count; i++) this.spawnEnemy()
    }
    if (!this.bossSpawned && this.elapsed >= GAME.bossTime) this.spawnBoss()
    this.updateEnemies(dt)
    this.fireClock -= dt
    if (this.fireClock <= 0) this.fire()
    this.updateBullets(dt)
    this.updateGems(dt)
    this.effects = this.effects.filter(effect => (effect.life -= dt) > 0)
    for (const effect of this.effects) { effect.x += effect.vx * dt; effect.y += effect.vy * dt }
    this.renderWorld()
    this.hudClock += dt
    if (this.hudClock >= 0.12) { this.hudClock = 0; this.emitHud() }
    if (isVictory(this.elapsed, this.bossSpawned, this.enemies.some(enemy => enemy.kind === 'boss'), this.player.hp)) this.end(true)
  }

  private resizeCamera(): void {
    const { width } = this.scale
    this.cameras.main.setZoom(width < 700 ? 0.76 : width < 1000 ? 0.88 : 1)
    this.cameras.main.centerOn(this.player.x, this.player.y)
    this.cameras.main.setFollowOffset(0, 0)
  }

  private paintGround(): void {
    const g = this.ground
    g.fillStyle(0x101b22).fillRect(0, 0, GAME.width, GAME.height)
    g.fillStyle(0x17242b, 0.55).fillRect(0, 325, GAME.width, 275).fillRect(0, 1050, GAME.width, 250)
    g.fillStyle(0x1b282e, 0.7).fillRect(470, 0, 230, GAME.height).fillRect(1600, 0, 260, GAME.height)
    g.lineStyle(2, 0x46524b, 0.19)
    for (let x = 0; x <= GAME.width; x += 80) g.lineBetween(x, 0, x, GAME.height)
    for (let y = 0; y <= GAME.height; y += 80) g.lineBetween(0, y, GAME.width, y)
    g.lineStyle(3, 0xb7aa69, 0.24)
    for (let x = 40; x < GAME.width; x += 145) { g.lineBetween(x, 461, x + 69, 461); g.lineBetween(x + 35, 1175, x + 105, 1175) }
    for (let y = 40; y < GAME.height; y += 145) { g.lineBetween(580, y, 580, y + 68); g.lineBetween(1730, y + 30, 1730, y + 100) }
    let seed = 49384
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
    for (let i = 0; i < 520; i++) {
      const x = random() * GAME.width, y = random() * GAME.height, s = 2 + random() * 9
      g.fillStyle(random() > 0.88 ? 0x7b8b66 : 0x607075, 0.08 + random() * 0.16).fillRect(x, y, s, s * 0.45)
    }
    for (let i = 0; i < 76; i++) {
      const x = random() * GAME.width, y = random() * GAME.height
      g.lineStyle(1, 0x546169, 0.28).lineBetween(x, y, x + 12 + random() * 28, y + 4 + random() * 18)
      g.lineBetween(x + 10, y + 6, x + 4, y + 20)
    }
    g.lineStyle(14, 0x35464a, 0.9).strokeRect(7, 7, GAME.width - 14, GAME.height - 14)
    g.lineStyle(2, 0xb8c37c, 0.25).strokeRect(18, 18, GAME.width - 36, GAME.height - 36)
  }

  private movePlayer(dt: number): void {
    const move = this.inputControl?.vector() ?? { x: 0, y: 0 }
    movePlayer(this.player, move, this.levels.speed, dt)
    this.cameras.main.centerOn(this.player.x, this.player.y)
  }

  private spawnPosition(): { x: number; y: number } {
    const cam = this.cameras.main
    return spawnPosition(this.player, cam.width / cam.zoom, cam.height / cam.zoom)
  }

  private spawnEnemy(): void {
    if (this.enemies.length >= GAME.enemyCap) return
    const kind = chooseEnemyKind(this.elapsed, Math.random())
    const pos = this.spawnPosition()
    const hp = enemyHealth(kind, this.elapsed)
    this.enemies.push({ ...pos, kind, hp, maxHp: hp, hit: 0, phase: Math.random() * 6 })
  }
  private spawnBoss(): void {
    this.bossSpawned = true
    const pos = this.spawnPosition()
    this.enemies.push({ ...pos, kind: 'boss', hp: ENEMY.boss.hp, maxHp: ENEMY.boss.hp, hit: 0, phase: 0 })
    this.bossClock = 3.5
    this.audio.play('boss')
    this.flash(pos.x, pos.y, 0xc6d16c, 16)
    this.emitHud()
  }

  private updateEnemies(dt: number): void {
    const boss = this.enemies.find(enemy => enemy.kind === 'boss')
    if (boss) this.updateBoss(boss, dt)
    for (const enemy of this.enemies) {
      enemy.hit = Math.max(0, enemy.hit - dt)
      enemy.phase += dt
      if (enemy.kind !== 'boss' || this.bossState === 'idle') {
        const dx = this.player.x - enemy.x, dy = this.player.y - enemy.y
        const length = Math.hypot(dx, dy) || 1
        const speed = ENEMY[enemy.kind].speed * (enemy.kind === 'boss' ? 1 : 1 + Math.min(this.elapsed / 900, 0.25))
        enemy.x += dx / length * speed * dt
        enemy.y += dy / length * speed * dt
      } else if (this.bossState === 'dash') {
        enemy.x = clamp(enemy.x + this.bossVector.x * 470 * dt, 50, GAME.width - 50)
        enemy.y = clamp(enemy.y + this.bossVector.y * 470 * dt, 50, GAME.height - 50)
      }
      const minDistance = ENEMY[enemy.kind].radius + GAME.playerRadius - 3
      const separation = distance(enemy.x, enemy.y, this.player.x, this.player.y)
      if (separation < minDistance && separation > 0) {
        enemy.x -= (this.player.x - enemy.x) / separation * Math.min(7, minDistance - separation)
        enemy.y -= (this.player.y - enemy.y) / separation * Math.min(7, minDistance - separation)
        this.hurtPlayer(ENEMY[enemy.kind].damage)
      }
    }
  }

  private updateBoss(boss: Enemy, dt: number): void {
    this.bossClock -= dt
    if (this.bossState === 'idle' && this.bossClock <= 0) {
      const dx = this.player.x - boss.x, dy = this.player.y - boss.y
      const length = Math.hypot(dx, dy) || 1
      this.bossVector = { x: dx / length, y: dy / length }
      this.bossState = 'warning'
      this.bossClock = 1.25
    } else if (this.bossState === 'warning' && this.bossClock <= 0) {
      this.bossState = 'dash'
      this.bossClock = 0.65
      this.audio.play('boss')
      if (!this.settings.reducedMotion) this.cameras.main.shake(170, 0.002)
    } else if (this.bossState === 'dash' && this.bossClock <= 0) {
      this.bossState = 'idle'
      this.bossClock = 4.2
    }
  }

  private fire(): void {
    const target = nearestEnemy(this.enemies, this.player.x, this.player.y)
    if (!target) return
    const aim = Math.atan2(target.y - this.player.y, target.x - this.player.x)
    this.player.facing = aim
    const count = 1 + this.levels.projectiles
    for (let i = 0; i < count; i++) {
      const angle = aim + (i - (count - 1) / 2) * 0.17
      const bullet = this.bulletPool.pop() ?? { x: 0, y: 0, vx: 0, vy: 0, life: 0, damage: 0, active: false }
      bullet.x = this.player.x + Math.cos(angle) * 22
      bullet.y = this.player.y + Math.sin(angle) * 22
      bullet.vx = Math.cos(angle) * GAME.bulletSpeed
      bullet.vy = Math.sin(angle) * GAME.bulletSpeed
      bullet.life = GAME.bulletLife
      bullet.damage = Math.round(GAME.baseDamage * (1 + this.levels.damage * 0.25))
      bullet.active = true
      this.bullets.push(bullet)
    }
    this.fireClock = GAME.baseFireInterval / (1 + this.levels.fireRate * 0.18)
    this.flash(this.player.x + Math.cos(aim) * 25, this.player.y + Math.sin(aim) * 25, 0xffbd63, 3)
    this.audio.play('shoot')
  }

  private updateBullets(dt: number): void {
    for (const bullet of this.bullets) {
      if (!bullet.active) continue
      const oldX = bullet.x, oldY = bullet.y
      bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt; bullet.life -= dt
      if (bullet.life <= 0 || bullet.x < 0 || bullet.y < 0 || bullet.x > GAME.width || bullet.y > GAME.height) { bullet.active = false; continue }
      for (const enemy of this.enemies) {
        if (segmentHitsCircle(oldX, oldY, bullet.x, bullet.y, enemy.x, enemy.y, ENEMY[enemy.kind].radius + 4)) {
          bullet.active = false
          enemy.hp -= bullet.damage
          enemy.hit = 0.09
          this.flash(bullet.x, bullet.y, 0xc9e77b, 3)
          this.audio.play('hit')
          if (enemy.hp <= 0) this.killEnemy(enemy)
          break
        }
      }
    }
    this.bullets = this.bullets.filter(bullet => {
      if (bullet.active) return true
      if (this.bulletPool.length < 100) this.bulletPool.push(bullet)
      return false
    })
  }

  private killEnemy(enemy: Enemy): void {
    this.enemies.splice(this.enemies.indexOf(enemy), 1)
    this.kills++
    if (enemy.kind === 'boss') { this.bossState = 'idle'; this.flash(enemy.x, enemy.y, 0xe8cf75, 32) }
    else if (this.gems.length < GAME.gemCap) this.gems.push({ x: enemy.x, y: enemy.y, value: ENEMY[enemy.kind].xp, phase: Math.random() * 6 })
    else {
      let closest = this.gems[0]
      for (const gem of this.gems) if (distance(gem.x, gem.y, enemy.x, enemy.y) < distance(closest.x, closest.y, enemy.x, enemy.y)) closest = gem
      closest.value += ENEMY[enemy.kind].xp
    }
    this.flash(enemy.x, enemy.y, ENEMY[enemy.kind].color, enemy.kind === 'boss' ? 28 : 6)
  }

  private updateGems(dt: number): void {
    const pickup = pickupRadius(this.levels.magnet)
    for (const gem of this.gems) {
      gem.phase += dt * 4
      pullGem(gem, this.player, pickup, dt)
      if (distance(gem.x, gem.y, this.player.x, this.player.y) < GAME.playerRadius + 8) {
        this.xp += gem.value
        gem.value = 0
        this.audio.play('pickup')
        this.flash(gem.x, gem.y, 0xb8f07d, 3)
      }
    }
    this.gems = this.gems.filter(gem => gem.value > 0)
    this.checkLevel()
  }

  private checkLevel(): void {
    if (this.mode !== 'running' || this.xp < xpRequired(this.level)) return
    this.xp -= xpRequired(this.level)
    this.level++
    this.mode = 'upgrade'
    this.clearInput()
    this.offered = chooseUpgrades(this.levels)
    this.audio.play('level')
    this.bridge.upgrade(this.offered, { ...this.levels })
    this.emitHud()
  }

  private hurtPlayer(damage: number): void {
    if (this.player.invulnerable > 0 || this.mode !== 'running') return
    this.player.hp = Math.max(0, this.player.hp - damage)
    this.player.invulnerable = 0.8
    this.flash(this.player.x, this.player.y, 0xf07169, 11)
    if (!this.settings.reducedMotion) this.cameras.main.shake(105, 0.004)
    this.emitHud()
    if (this.player.hp <= 0) this.end(false)
  }

  private end(victory: boolean): void {
    if (this.mode === 'ended') return
    this.mode = 'ended'
    this.clearInput()
    this.audio.play(victory ? 'win' : 'death')
    this.bridge.finish({ victory, time: this.elapsed, kills: this.kills, level: this.level })
  }

  private flash(x: number, y: number, color: number, count: number): void {
    const limit = this.settings.reducedMotion ? Math.ceil(count / 3) : count
    for (let i = 0; i < limit; i++) {
      const angle = Math.random() * Math.PI * 2, speed = 25 + Math.random() * 110
      this.effects.push({ x, y, life: 0.16 + Math.random() * 0.25, maxLife: 0.4, color, radius: 1.5 + Math.random() * 3, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed })
    }
    if (this.effects.length > 220) this.effects.splice(0, this.effects.length - 220)
  }

  private renderWorld(): void {
    const g = this.draw, fx = this.fx
    g.clear(); fx.clear()
    if (this.bossState === 'warning') {
      const boss = this.enemies.find(enemy => enemy.kind === 'boss')
      if (boss) {
        const endX = boss.x + this.bossVector.x * 560, endY = boss.y + this.bossVector.y * 560
        g.lineStyle(80, 0xee6a59, 0.10 + (1.25 - this.bossClock) * 0.08).lineBetween(boss.x, boss.y, endX, endY)
        g.lineStyle(3, 0xff8572, 0.5).lineBetween(boss.x, boss.y, endX, endY)
        g.lineStyle(3, 0xff8572, 0.6).strokeCircle(boss.x, boss.y, 56 + (1.25 - this.bossClock) * 12)
      }
    }
    for (const gem of this.gems) {
      const bob = Math.sin(gem.phase) * 3
      g.fillStyle(0xb4f37b, 0.10).fillCircle(gem.x, gem.y + bob, 15)
      g.fillStyle(0xc8f985).fillTriangle(gem.x, gem.y - 7 + bob, gem.x + 6, gem.y + bob, gem.x, gem.y + 7 + bob)
      g.fillTriangle(gem.x, gem.y - 7 + bob, gem.x - 6, gem.y + bob, gem.x, gem.y + 7 + bob)
      g.fillStyle(0xffffff, 0.6).fillCircle(gem.x - 1, gem.y - 2 + bob, 1.5)
    }
    for (const enemy of this.enemies) this.drawEnemy(g, enemy)
    for (const bullet of this.bullets) {
      g.lineStyle(4, 0xffbd67, 0.42).lineBetween(bullet.x - bullet.vx * 0.025, bullet.y - bullet.vy * 0.025, bullet.x, bullet.y)
      g.fillStyle(0xffdd91).fillCircle(bullet.x, bullet.y, 4)
    }
    this.drawPlayer(g)
    for (const effect of this.effects) fx.fillStyle(effect.color, clamp(effect.life / effect.maxLife, 0, 1)).fillCircle(effect.x, effect.y, effect.radius)
  }

  private drawEnemy(g: Phaser.GameObjects.Graphics, enemy: Enemy): void {
    const { radius, color } = ENEMY[enemy.kind]
    const bob = Math.sin(enemy.phase * (enemy.kind === 'runner' ? 12 : 5)) * 1.4
    g.fillStyle(0x020a0d, 0.45).fillEllipse(enemy.x, enemy.y + radius * 0.65, radius * 2.3, radius * 0.8)
    if (enemy.kind === 'boss') {
      g.fillStyle(0x879b5b, 0.20).fillCircle(enemy.x, enemy.y, 64)
      g.lineStyle(5, 0x95aa68, 0.35).strokeCircle(enemy.x, enemy.y, 54)
    }
    g.fillStyle(enemy.hit > 0 ? 0xe9f8d0 : color).fillCircle(enemy.x, enemy.y + bob, radius)
    g.lineStyle(enemy.kind === 'boss' ? 5 : 3, 0x253c35, 0.9).strokeCircle(enemy.x, enemy.y + bob, radius - 2)
    if (enemy.kind === 'brute' || enemy.kind === 'boss') {
      g.fillStyle(0x334c45).fillRoundedRect(enemy.x - radius * 0.92, enemy.y - radius * 0.5, radius * 0.62, radius * 0.65, 3)
      g.fillRoundedRect(enemy.x + radius * 0.32, enemy.y - radius * 0.5, radius * 0.62, radius * 0.65, 3)
    }
    if (enemy.kind === 'runner') {
      g.fillStyle(0x304742).fillTriangle(enemy.x - 11, enemy.y - 10, enemy.x - 6, enemy.y - 20, enemy.x, enemy.y - 11)
      g.fillTriangle(enemy.x + 11, enemy.y - 10, enemy.x + 6, enemy.y - 20, enemy.x, enemy.y - 11)
    }
    const eyeOffset = enemy.kind === 'boss' ? 16 : radius * 0.38
    g.fillStyle(0xf7e995).fillCircle(enemy.x - eyeOffset, enemy.y - 3 + bob, enemy.kind === 'boss' ? 5 : 2.6)
    g.fillCircle(enemy.x + eyeOffset, enemy.y - 3 + bob, enemy.kind === 'boss' ? 5 : 2.6)
    g.lineStyle(enemy.kind === 'boss' ? 4 : 2, 0x243a31, 0.8).lineBetween(enemy.x - radius * 0.28, enemy.y + radius * 0.35, enemy.x + radius * 0.28, enemy.y + radius * 0.4)
    if (enemy.hp < enemy.maxHp && enemy.kind !== 'boss') {
      g.fillStyle(0x0c1516).fillRect(enemy.x - radius, enemy.y - radius - 11, radius * 2, 4)
      g.fillStyle(0xbddc75).fillRect(enemy.x - radius, enemy.y - radius - 11, radius * 2 * enemy.hp / enemy.maxHp, 4)
    }
  }

  private drawPlayer(g: Phaser.GameObjects.Graphics): void {
    const p = this.player
    const visible = p.invulnerable <= 0 || Math.floor(p.invulnerable * 15) % 2 === 0
    if (!visible) return
    g.fillStyle(0x02080c, 0.5).fillEllipse(p.x, p.y + 14, 40, 15)
    g.fillStyle(0x5caeb2, 0.10).fillCircle(p.x, p.y, 25)
    g.fillStyle(0x273c4a).fillCircle(p.x, p.y, 16)
    g.lineStyle(3, 0x8cbdba).strokeCircle(p.x, p.y, 14)
    g.fillStyle(0xc4d8c4).fillCircle(p.x, p.y - 3, 8)
    g.fillStyle(0x355b61).fillRoundedRect(p.x - 9, p.y - 14, 18, 7, 2)
    g.fillStyle(0xffd37a).fillCircle(p.x + Math.cos(p.facing) * 16, p.y + Math.sin(p.facing) * 16, 3)
    g.lineStyle(8, 0x1c2c35).lineBetween(p.x + Math.cos(p.facing) * 6, p.y + Math.sin(p.facing) * 6, p.x + Math.cos(p.facing) * 23, p.y + Math.sin(p.facing) * 23)
    g.lineStyle(3, 0xd9c49a).lineBetween(p.x + Math.cos(p.facing) * 14, p.y + Math.sin(p.facing) * 14, p.x + Math.cos(p.facing) * 24, p.y + Math.sin(p.facing) * 24)
  }

  private emitHud(): void {
    const boss = this.enemies.find(enemy => enemy.kind === 'boss')
    this.bridge.hud({ hp: this.player.hp, maxHp: this.player.maxHp, xp: this.xp, xpNeed: xpRequired(this.level), level: this.level, time: this.elapsed, kills: this.kills, bossHp: boss?.hp ?? 0, bossMaxHp: boss?.maxHp ?? 0 })
  }
}
