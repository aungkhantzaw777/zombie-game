import { useEffect, useRef, type RefObject } from 'react'
import Phaser from 'phaser'
import { DeadshiftScene, type SceneBridge } from './scene'
import type { AudioEngine } from './audio'
import type { Settings } from '../lib/persistence'

interface Props { bridge: SceneBridge; audio: AudioEngine; settings: Settings; sceneRef: RefObject<DeadshiftScene | null> }

export function GameHost({ bridge, audio, settings, sceneRef }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const bridgeRef = useRef(bridge)
  useEffect(() => { bridgeRef.current = bridge }, [bridge])

  useEffect(() => {
    if (!container.current) return
    const scene = new DeadshiftScene({
      hud: value => bridgeRef.current.hud(value),
      upgrade: (choices, levels) => bridgeRef.current.upgrade(choices, levels),
      resume: () => bridgeRef.current.resume(),
      finish: result => bridgeRef.current.finish(result),
    }, audio, settings)
    sceneRef.current = scene
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container.current,
      backgroundColor: '#101b22',
      antialias: true,
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH, width: container.current.clientWidth, height: container.current.clientHeight },
      scene,
      render: { pixelArt: false, antialias: true },
    })
    return () => {
      scene.dispose()
      sceneRef.current = null
      game.destroy(true)
    }
    // This lifecycle only depends on the run key. Settings are forwarded below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { sceneRef.current?.setSettings(settings) }, [sceneRef, settings])
  return <div className="game-canvas" ref={container} aria-label="Zombie survivor game world" />
}
