import { settings } from './settings'

let ctx: AudioContext | null = null

// Browsers only allow sound after a tap, so unlock audio on the first one.
if (typeof window !== 'undefined')
  window.addEventListener(
    'pointerdown',
    () => {
      try {
        ctx ??= new AudioContext()
        void ctx.resume()
      } catch {
        /* no audio */
      }
    },
    { once: true },
  )

/** A short beep: 'alert' for emergencies (two low tones), 'info' for rare planes and circling. */
export function beep(kind: 'alert' | 'info' = 'info') {
  if (!settings.get().sounds || !ctx) return
  const tones = kind === 'alert' ? [660, 520] : [880, 1320]
  tones.forEach((f, i) => {
    const o = ctx!.createOscillator()
    const g = ctx!.createGain()
    o.frequency.value = f
    o.type = 'sine'
    const t = ctx!.currentTime + i * 0.18
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    o.connect(g).connect(ctx!.destination)
    o.start(t)
    o.stop(t + 0.17)
  })
}
