import type { ReactNode } from 'react'
import { settings, type Settings } from '../lib/settings'
import NotifySection from './NotifySection'

function Toggle({ k, label, hint }: { k: keyof Settings; label: string; hint?: string }) {
  const s = settings.use()
  const on = !!s[k]
  return (
    <label className="flex cursor-pointer items-start gap-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-slate-100">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
      <input type="checkbox" className="peer sr-only" checked={on} onChange={(e) => settings.update({ [k]: e.target.checked } as Partial<Settings>)} id={`set-${k}`} />
      <span
        aria-hidden
        className={`relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-sky-400 ${on ? 'bg-sky-500' : 'bg-slate-700'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </label>
  )
}

function Choice<K extends keyof Settings>({ k, label, options }: { k: K; label: string; options: [Settings[K], string][] }) {
  const s = settings.use()
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="flex-1 text-sm text-slate-100">{label}</span>
      <div className="flex overflow-hidden rounded-md ring-1 ring-slate-700">
        {options.map(([v, text]) => (
          <button
            key={String(v)}
            onClick={() => settings.update({ [k]: v } as Partial<Settings>)}
            className={`px-2.5 py-1 text-xs font-semibold ${s[k] === v ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-4 py-3">
      <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
      <div className="divide-y divide-slate-800">{children}</div>
    </section>
  )
}

export default function SettingsPanel({ onClose, center }: { onClose: () => void; center: { lat: number; lon: number; label: string } }) {
  const s = settings.use()
  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/60 md:items-center md:p-4" onClick={onClose}>
      <div
        className="flex max-h-[92%] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-slate-900 ring-1 ring-slate-700 md:max-h-full md:rounded-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Settings"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-lg font-bold">Settings</h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-sm font-semibold text-sky-300 hover:bg-slate-800">
            Done
          </button>
        </div>
        <div className="overflow-y-auto divide-y divide-slate-800">
          <NotifySection center={center} />

          <Section title="Rare plane spotter">
            <Toggle k="rareSpotter" label="Look for rare planes" hint="Checks every 5 minutes and lists them under 🔔" />
            {s.rareSpotter && (
              <>
                <Toggle k="rareLegendary" label="Legendary" hint="Air Force One, Doomsday plane, B-52, warbirds, Beluga, An-124…" />
                <Toggle k="rareRare" label="Rare" hint="747SP, AWACS, U-2, Dreamlifter, C-5, DC-10, TriStar…" />
                <Toggle k="rareUncommon" label="Uncommon" hint="A380, 747-8, MD-11, Osprey… (lots of these)" />
                <Toggle k="rareWorldwide" label="Search the whole world" hint="Off: only planes in your current area" />
                <Toggle k="rareToasts" label="Pop-up when a new one appears" />
              </>
            )}
          </Section>

          <Section title="Something's happening">
            <Toggle k="happening" label="Spot planes circling one place" hint="Police, news and medical helicopters circling usually means something is going on" />
            {s.happening && <Toggle k="happeningIgnoreAirports" label="Ignore circling right at airports" hint="Training flights loop around airports all day" />}
          </Section>

          <Section title="Alerts in the app">
            <Toggle k="emergencyBanner" label="Red emergency banner" />
            <Toggle k="sounds" label="Sounds" hint="A beep for new emergencies, rare planes and circling" />
          </Section>

          <Section title="Map">
            <Choice k="baseMap" label="Map style" options={[['dark', 'Dark'], ['streets', 'Streets'], ['satellite', 'Satellite']]} />
            <Toggle k="trails" label="Trails behind planes" />
            <Toggle k="airports" label="Airports and runways" />
            <Toggle k="labels" label="Callsign labels on planes" hint="Shown when zoomed in" />
            <Toggle k="rangeRing" label="Circle around your search area" />
            <Toggle k="followSelected" label="Follow the selected plane" hint="Keeps it in the middle of the map" />
            <Toggle k="groundVehicles" label="Show airport ground vehicles" />
          </Section>

          <Section title="Units & time">
            <Choice k="altUnit" label="Altitude" options={[['ft', 'Feet'], ['m', 'Metres']]} />
            <Choice k="speedUnit" label="Speed" options={[['kt', 'Knots'], ['mph', 'mph'], ['kmh', 'km/h']]} />
            <Toggle k="clock24" label="24-hour clock" />
          </Section>

          <Section title="Updates">
            <Choice k="refresh" label="Refresh" options={[['fast', 'Fast 4s'], ['normal', '6s'], ['saver', 'Saver 15s']]} />
          </Section>

          <div className="px-4 py-4 text-center">
            <button onClick={() => settings.reset()} className="rounded-md px-3 py-1.5 text-xs text-slate-500 ring-1 ring-slate-700 hover:text-slate-300">
              Reset settings
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
