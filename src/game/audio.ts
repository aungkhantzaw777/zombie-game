import type { Settings } from '../lib/persistence'

export type Sound = 'shoot' | 'hit' | 'pickup' | 'level' | 'death' | 'boss' | 'win'

export class AudioEngine {
  private context: AudioContext | null = null
  private settings: Settings
  constructor(settings: Settings) { this.settings = settings }
  setSettings(settings: Settings): void { this.settings = settings }
  unlock(): void {
    if (!this.context) {
      try { this.context = new AudioContext() } catch { return }
    }
    void this.context.resume()
  }
  play(sound: Sound): void {
    if (!this.context || this.settings.muted || this.settings.volume <= 0) return
    const profiles: Record<Sound, [number, number, number, OscillatorType]> = {
      shoot: [370, 120, 0.075, 'sawtooth'], hit: [170, 58, 0.13, 'square'],
      pickup: [600, 890, 0.11, 'sine'], level: [480, 960, 0.28, 'triangle'],
      death: [280, 50, 0.45, 'sawtooth'], boss: [90, 170, 0.4, 'sawtooth'],
      win: [440, 880, 0.55, 'triangle'],
    }
    const [from, to, duration, wave] = profiles[sound]
    const now = this.context.currentTime
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.type = wave
    oscillator.frequency.setValueAtTime(from, now)
    oscillator.frequency.exponentialRampToValueAtTime(to, now + duration)
    gain.gain.setValueAtTime(Math.max(0.0001, this.settings.volume * (sound === 'shoot' ? 0.045 : 0.11)), now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    oscillator.connect(gain).connect(this.context.destination)
    oscillator.start(now)
    oscillator.stop(now + duration)
  }
  dispose(): void { if (this.context) void this.context.close(); this.context = null }
}
