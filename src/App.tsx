import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'
import { GameHost } from './game/GameHost'
import { DeadshiftScene, type HudState, type RunResult, type SceneBridge } from './game/scene'
import { AudioEngine } from './game/audio'
import { formatTime } from './game/progression'
import { UPGRADES, type UpgradeId, type UpgradeLevels } from './game/upgrades'
import { loadBests, loadSettings, saveBests, saveSettings, updateBests, type Settings } from './lib/persistence'
import './App.css'

type Screen = 'menu' | 'how' | 'settings' | 'playing' | 'pause' | 'upgrade' | 'result'
const initialHud: HudState = { hp: 100, maxHp: 100, xp: 0, xpNeed: 22, level: 1, time: 0, kills: 0, bossHp: 0, bossMaxHp: 0 }

function TitleArt() {
  return <div className="title-art" aria-hidden="true">
    <div className="art-glow" />
    <svg viewBox="0 0 700 510" preserveAspectRatio="xMidYMid meet">
      <path d="M0 258 126 215 235 264 386 206 542 243 700 180V510H0Z" fill="#1c3034" />
      <path d="M0 297 121 272 280 323 397 265 516 298 700 252" fill="none" stroke="#425952" strokeOpacity=".38" strokeWidth="3" />
      <path d="M0 391 162 342 312 402 481 330 700 389M57 510 253 422 446 478 621 420" fill="none" stroke="#52635b" strokeOpacity=".2" strokeWidth="2" />
      <g fill="#14252c"><path d="M23 245V90h85v164M118 222V39h105v231M234 252V117h71v150M499 233V75h105v150M613 212V26h77v219" /></g>
      <g fill="#718c70" opacity=".38"><path d="M39 112h12v17H39zm27 0h11v17H66zm84-45h11v16h-11zm34 41h11v17h-11zm329-8h11v15h-11zm42 45h12v16h-12zm88-99h11v18h-11z" /></g>
      <ellipse cx="360" cy="338" rx="155" ry="89" fill="#a5db75" opacity=".06" />
      <g transform="translate(339 265)"><ellipse cy="95" rx="68" ry="18" fill="#030b0f" opacity=".65" /><path d="M-35 19-49 99h30l17-65zm56 0 29 80h-30L4 37" fill="#253941" /><path d="M-39-35q38-39 77 0l13 78-96 3z" fill="#34555a" stroke="#9bb6a2" strokeWidth="4" /><path d="M-29-59q29-30 57 0v28h-57z" fill="#c5d3b9" /><path d="M-39-67q38-25 77 0v13h-77z" fill="#344e50" /><path d="m22-6 100 20-4 13-98-13z" fill="#1a2b32" stroke="#b4b9a3" strokeWidth="4" /><path d="m112 13 37-3 1 12-35 5z" fill="#e6b868" /></g>
      <g transform="translate(133 256)" fill="#8cae64"><ellipse cy="66" rx="29" ry="10" fill="#041014" /><path d="M-25 5q24-21 50 0l10 56h-70z" /><circle cy="-10" r="23" /><path d="M-23-15-37-38l-8 11 17 28M24-16l31-13 4 14-30 19" /></g><g fill="#f3e390"><circle cx="124" cy="245" r="4" /><circle cx="143" cy="245" r="4" /></g>
      <g transform="translate(573 287)" fill="#799c61"><ellipse cy="68" rx="37" ry="12" fill="#041014" /><path d="M-30 5q29-25 61 0l9 60h-80z" /><circle cy="-12" r="30" /><path d="M-30-12-53-31l-11 14 29 20M27-11l28-29 12 11-30 35" /></g><g fill="#f3e390"><circle cx="562" cy="276" r="5" /><circle cx="584" cy="276" r="5" /></g>
      <g fill="#b8ef7d" opacity=".75"><path d="m220 372 8-10 8 10-8 10zm292 45 7-8 7 8-7 8zM92 427l6-8 7 8-7 8z" /></g>
    </svg>
    <span className="art-caption">SECTOR 07 · SIGNAL LOST</span><span className="art-coord">40.72° N / 73.99° W</span>
  </div>
}

function Joystick({ sceneRef }: { sceneRef: RefObject<DeadshiftScene | null> }) {
  const base = useRef<HTMLDivElement>(null)
  const [point, setPoint] = useState({ x: 0, y: 0 })
  const active = useRef<number | null>(null)
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (active.current !== event.pointerId || !base.current) return
    const rect = base.current.getBoundingClientRect()
    const dx = event.clientX - rect.left - rect.width / 2, dy = event.clientY - rect.top - rect.height / 2
    const ratio = Math.min(1, 42 / (Math.hypot(dx, dy) || 1))
    const x = dx * ratio, y = dy * ratio
    setPoint({ x, y }); sceneRef.current?.setStick(x / 42, y / 42)
  }
  const stop = (event: PointerEvent<HTMLDivElement>) => {
    if (active.current !== event.pointerId) return
    active.current = null; setPoint({ x: 0, y: 0 }); sceneRef.current?.setStick(0, 0)
  }
  return <div className="joystick" ref={base} aria-label="Movement joystick" onPointerDown={event => { active.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); move(event) }} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop}><div className="joystick-stick" style={{ transform: `translate(${point.x}px, ${point.y}px)` }} /></div>
}

function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [runId, setRunId] = useState(0)
  const [hud, setHud] = useState<HudState>(initialHud)
  const [choices, setChoices] = useState<UpgradeId[]>([])
  const [levels, setLevels] = useState<UpgradeLevels | null>(null)
  const [result, setResult] = useState<RunResult | null>(null)
  const [settings, setSettings] = useState(loadSettings)
  const [bests, setBests] = useState(loadBests)
  const sceneRef = useRef<DeadshiftScene | null>(null)
  const [audio] = useState(() => new AudioEngine(settings))

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings(current => {
      const next = { ...current, ...patch }; saveSettings(next); audio.setSettings(next); return next
    })
  }, [audio])
  const startRun = () => {
    audio.unlock(); setHud(initialHud); setChoices([]); setLevels(null); setResult(null)
    setRunId(value => value + 1); setScreen('playing')
  }
  const pause = useCallback(() => { sceneRef.current?.pauseRun(); setScreen(current => current === 'playing' ? 'pause' : current) }, [])
  const resume = useCallback(() => { sceneRef.current?.resumeRun(); setScreen(current => current === 'pause' ? 'playing' : current) }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (screen === 'playing') pause()
      else if (screen === 'pause') resume()
      else if (screen === 'how' || screen === 'settings') setScreen('menu')
    }
    const onVisibility = () => { if (document.hidden && screen === 'playing') pause() }
    window.addEventListener('keydown', onKey); document.addEventListener('visibilitychange', onVisibility)
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVisibility) }
  }, [screen, pause, resume])
  useEffect(() => () => { audio.dispose() }, [audio])

  const bridge: SceneBridge = {
    hud: value => setHud(value),
    upgrade: (options, current) => { setChoices(options); setLevels(current); setScreen('upgrade') },
    resume: () => setScreen('playing'),
    finish: value => { setResult(value); setBests(current => { const next = updateBests(current, value); saveBests(next); return next }); setScreen('result') },
  }
  const inRun = ['playing', 'pause', 'upgrade', 'result'].includes(screen)

  return <main className={`app ${inRun ? 'app-running' : ''}`}>
    {inRun && <GameHost key={runId} bridge={bridge} audio={audio} settings={settings} sceneRef={sceneRef} />}
    {!inRun && <div className="menu-shell">
      <header className="site-header"><div className="brand"><span className="brand-mark">D<span>↗</span></span><span>DEADSHIFT <small>© 2026</small></span></div><div className="header-right"><span className="live-dot" /> SURVIVAL PROTOCOL <span className="header-divider">/</span> BUILD 1.0</div></header>
      {screen === 'menu' && <div className="title-layout"><section className="title-content">
        <div className="eyebrow"><span className="tiny-line" /> THE CITY IS GONE. YOU'RE STILL HERE.</div>
        <h1>DEAD<span>SHIFT</span><em>— ZOMBIE SURVIVOR</em></h1>
        <p className="title-copy">Five minutes between you and daylight. Keep moving. Keep firing. When the signal comes, take down what followed it.</p>
        <div className="menu-actions"><button className="button button-primary" onClick={startRun}><span className="button-icon">▶</span> START SURVIVING <span className="button-arrow">↗</span></button><button className="button button-secondary" onClick={() => setScreen('how')}>HOW TO PLAY <span>↗</span></button></div>
        <button className="text-button" onClick={() => setScreen('settings')}><span className="gear">⚙</span> SETTINGS & AUDIO</button>
        <div className="title-stats"><div><span>YOUR BEST</span><strong>{formatTime(bests.longest)}</strong></div><div><span>MOST KILLS</span><strong>{bests.mostKills.toString().padStart(3, '0')}</strong></div><div><span>EXTRACTIONS</span><strong>{bests.victories.toString().padStart(2, '0')}</strong></div></div>
      </section><TitleArt /></div>}
      {screen === 'how' && <section className="info-panel"><button className="back-link" onClick={() => setScreen('menu')}>← BACK TO MENU</button><p className="eyebrow">FIELD MANUAL / 01</p><h2>STAY IN MOTION<span>.</span></h2><p className="info-lead">Your weapon fires automatically at the nearest zombie in range. Survive five minutes and eliminate the boss to escape.</p><div className="instruction-grid"><div><span className="instruction-number">01 / MOVE</span><strong>WASD or arrow keys</strong><p>On touch screens, use the left joystick. The arena has hard boundaries.</p></div><div><span className="instruction-number">02 / GROW</span><strong>Collect green XP</strong><p>Every level pauses the action. Choose one of three upgrades to strengthen your build.</p></div><div><span className="instruction-number">03 / SURVIVE</span><strong>Watch the warning line</strong><p>At 4:00, the boss arrives. Move out of its red charge path before it strikes.</p></div><div><span className="instruction-number">04 / CONTROL</span><strong>Escape to pause</strong><p>Use the pause button on touch screens. Your run also pauses when the tab is hidden.</p></div></div><button className="button button-primary" onClick={startRun}>I'M READY <span className="button-arrow">↗</span></button></section>}
      {screen === 'settings' && <section className="info-panel settings-panel"><button className="back-link" onClick={() => setScreen('menu')}>← BACK TO MENU</button><p className="eyebrow">SYSTEM / PREFERENCES</p><h2>SETTINGS<span>.</span></h2><div className="setting-row"><div><strong>Sound effects</strong><p>Procedural audio for combat and pickups.</p></div><button className={`toggle ${settings.muted ? '' : 'on'}`} onClick={() => { audio.unlock(); updateSettings({ muted: !settings.muted }) }} aria-pressed={!settings.muted}>{settings.muted ? 'OFF' : 'ON'}</button></div><div className="setting-row"><div><strong>Volume</strong><p>Adjust sound effect level.</p></div><input aria-label="Volume" type="range" min="0" max="1" step="0.05" value={settings.volume} onChange={event => { audio.unlock(); updateSettings({ volume: Number(event.target.value) }) }} /></div><div className="setting-row"><div><strong>Reduced motion</strong><p>Remove screen shake and limit particles.</p></div><button className={`toggle ${settings.reducedMotion ? 'on' : ''}`} onClick={() => updateSettings({ reducedMotion: !settings.reducedMotion })} aria-pressed={settings.reducedMotion}>{settings.reducedMotion ? 'ON' : 'OFF'}</button></div><p className="storage-note">Settings and records are stored in this browser.</p></section>}
      <footer className="site-footer"><span>NO SAVE POINTS. NO SECOND CHANCES.</span><span>BUILT FOR THE LAST STAND <span className="footer-cross">✳</span></span></footer>
    </div>}
    {inRun && <><div className="hud hud-top"><div className="hud-logo">D<span>↗</span><small>DEADSHIFT</small></div><div className="hud-center"><span className="hud-label">SURVIVAL TIME</span><strong>{formatTime(hud.time)} <i>/ 05:00</i></strong></div><button className="pause-button" onClick={pause} aria-label="Pause game">Ⅱ <span>PAUSE</span></button></div>
      <div className="hud hud-bottom"><div className="status-panel"><div className="stat-heading"><span>HEALTH</span><strong>{Math.ceil(hud.hp)} <i>/ {hud.maxHp}</i></strong></div><div className="meter hp-meter"><span style={{ width: `${Math.max(0, hud.hp / hud.maxHp * 100)}%` }} /></div><div className="stat-heading xp-heading"><span>LEVEL {hud.level.toString().padStart(2, '0')} <i>· XP</i></span><strong>{hud.xp} <i>/ {hud.xpNeed}</i></strong></div><div className="meter xp-meter"><span style={{ width: `${Math.min(100, hud.xp / hud.xpNeed * 100)}%` }} /></div></div><div className="kill-panel"><span>KILLS</span><strong>{hud.kills.toString().padStart(3, '0')}</strong></div></div>
      {hud.bossMaxHp > 0 && <div className="boss-hud"><div><span>⚠ ANOMALY DETECTED</span><strong>THE WARDEN</strong></div><div className="meter"><span style={{ width: `${Math.max(0, hud.bossHp / hud.bossMaxHp * 100)}%` }} /></div></div>}
      {screen === 'playing' && <Joystick sceneRef={sceneRef} />}</>}
    {screen === 'pause' && <div className="overlay"><div className="modal"><p className="eyebrow">RUN INTERRUPTED</p><h2>PAUSED<span>.</span></h2><p className="modal-copy">Take a breath. The dead can wait.</p><div className="modal-actions"><button className="button button-primary" onClick={resume}>RESUME <span className="button-arrow">↗</span></button><button className="button button-secondary" onClick={startRun}>RESTART RUN</button><button className="text-button" onClick={() => setScreen('menu')}>RETURN TO MENU</button></div><button className="sound-inline" onClick={() => updateSettings({ muted: !settings.muted })}>SOUND: {settings.muted ? 'OFF' : 'ON'}</button></div></div>}
    {screen === 'upgrade' && <div className="overlay"><div className="modal upgrade-modal"><p className="eyebrow">NEW LEVEL REACHED / {hud.level.toString().padStart(2, '0')}</p><h2>CHOOSE YOUR EDGE<span>.</span></h2><p className="modal-copy">The streets don't get easier. You get stronger.</p><div className="upgrade-grid">{choices.map((id, index) => <button className="upgrade-card" key={id} onClick={() => sceneRef.current?.choose(id)}><span className="upgrade-index">0{index + 1} / UPGRADE</span><span className="upgrade-icon">{UPGRADES[id].icon}</span><strong>{UPGRADES[id].name}</strong><span className="upgrade-description">{UPGRADES[id].description}</span><span className="upgrade-level">{id === 'recovery' ? 'RECOVER' : `LV ${levels?.[id] ?? 0} → ${(levels?.[id] ?? 0) + 1} / ${UPGRADES[id].cap}`} <span>↗</span></span></button>)}</div></div></div>}
    {screen === 'result' && result && <div className="overlay"><div className="modal result-modal"><p className="eyebrow">{result.victory ? 'EXTRACTION COMPLETE' : 'SIGNAL LOST'}</p><h2>{result.victory ? 'YOU SURVIVED' : 'GAME OVER'}<span>.</span></h2><p className="modal-copy">{result.victory ? 'Daylight found you still standing.' : 'The city claimed another survivor. Go again.'}</p><div className="result-grid"><div><span>TIME SURVIVED</span><strong>{formatTime(result.time)}</strong><small>BEST {formatTime(bests.longest)}</small></div><div><span>ZOMBIES KILLED</span><strong>{result.kills}</strong><small>BEST {bests.mostKills}</small></div><div><span>LEVEL REACHED</span><strong>{result.level}</strong><small>BEST {bests.highestLevel}</small></div></div><div className="modal-actions"><button className="button button-primary" onClick={startRun}>PLAY AGAIN <span className="button-arrow">↗</span></button><button className="button button-secondary" onClick={() => setScreen('menu')}>MAIN MENU</button></div></div></div>}
  </main>
}

export default App
