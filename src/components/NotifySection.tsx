import { useEffect, useState } from 'react'
import { settings, type Settings } from '../lib/settings'
import { disablePush, enablePush, linkWithCode, pullRelayState, pushStore, pushSupport, sendTestPush, syncPushConfig } from '../lib/push'
import { fmtClock, fmtRelative } from '../lib/format'
import { account } from '../lib/account'
import { fmtDistRound } from '../lib/format'

function Check({ k, label }: { k: keyof Settings; label: string }) {
  const s = settings.use()
  return (
    <label className="flex items-center justify-between gap-3 py-2 text-sm">
      {label}
      <input id={`n-${k}`} type="checkbox" className="h-5 w-5 accent-sky-500" checked={!!s[k]} onChange={(e) => settings.update({ [k]: e.target.checked } as Partial<Settings>)} />
    </label>
  )
}

export default function NotifySection({ center }: { center: { lat: number; lon: number; label: string } }) {
  const s = settings.use()
  const push = pushStore.use()
  const profile = account.use()
  const support = pushSupport()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [relay, setRelay] = useState<{ lastRun?: number; devices?: number } | null>(null)
  const [code, setCode] = useState('')

  useEffect(() => {
    if (push.token) pullRelayState().then(setRelay)
  }, [push.token])

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
      setMsg(ok)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="px-4 py-3">
      <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Notifications when SkyWatch is closed</h3>
      <p className="mb-2 text-xs text-slate-500">
        Your SkyWatch relay checks every few minutes and sends alerts to this phone, even when SkyWatch is closed.
      </p>

      {push.enabled ? (
        <div className="mb-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          On for this device.{' '}
          {relay?.lastRun ? `Last background check ${fmtRelative(relay.lastRun)} (${fmtClock(relay.lastRun)}).` : 'Waiting for the first background check.'}
        </div>
      ) : !support.ok ? (
        <div className="mb-2 rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-200">{support.reason}</div>
      ) : null}

      <div className="divide-y divide-slate-800">
        <Check k="notifyTeams" label="🛫 Team planes take off or land" />
        <Check k="notifyEmergencies" label="⚠️ Emergencies near home" />
        <Check k="notifyRare" label="✨ Rare planes (anywhere in the world)" />
        <div className="flex items-center justify-between gap-3 py-2 text-sm">
          <div>
            Home
            <div className="text-xs text-slate-500">{s.home ? s.home.label : 'Not set: emergency alerts need it'}</div>
          </div>
          <button
            onClick={() => settings.update({ home: { lat: center.lat, lon: center.lon, label: center.label } })}
            className="shrink-0 rounded-md bg-slate-800 px-2.5 py-1 text-xs ring-1 ring-slate-700"
          >
            Use {center.label.length > 18 ? 'current map' : center.label}
          </button>
        </div>
        <div className="flex items-center justify-between gap-3 py-2 text-sm">
          Emergency alert distance
          <select
            id="notify-radius"
            value={s.notifyRadius}
            onChange={(e) => settings.update({ notifyRadius: Number(e.target.value) })}
            className="rounded bg-slate-800 px-1.5 py-1 text-xs ring-1 ring-slate-700"
          >
            {[25, 50, 100, 150, 250].map((r) => (
              <option key={r} value={r}>
                {fmtDistRound(r)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {!push.enabled ? (
          <button
            disabled={busy || !support.ok}
            onClick={() => run(() => enablePush(), 'Notifications are on. Try "Send a test".')}
            className="flex-1 rounded-md bg-sky-500 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
          >
            Turn on notifications
          </button>
        ) : (
          <>
            <button disabled={busy} onClick={() => run(async () => { await syncPushConfig(); const r = await sendTestPush(); if (!r.sent) throw new Error('The relay could not reach this device.') }, 'Test sent. It should arrive in a few seconds.')} className="flex-1 rounded-md bg-sky-500 py-2 text-sm font-semibold text-slate-950">
              Send a test
            </button>
            <button disabled={busy} onClick={() => run(disablePush, 'Notifications are off for this device.')} className="rounded-md px-3 py-2 text-sm text-slate-400 ring-1 ring-slate-700">
              Turn off
            </button>
          </>
        )}
      </div>
      {!push.enabled && !profile.token && (
        <p className="mt-2 text-[11px] text-amber-200/80">
          Reinstalled SkyWatch, or used notifications on another phone before? Sign in to your profile above first, so the relay knows it's you.
        </p>
      )}
      {msg && <p className="mt-2 text-xs text-slate-300">{msg}</p>}
      {push.error && <p className="mt-2 text-xs text-red-300">Couldn't update the relay: {push.error}</p>}

      <details className="mt-3 text-xs text-slate-400">
        <summary className="cursor-pointer">Use with another device (e.g. your PC)</summary>
        {push.token ? (
          <p className="mt-2">
            Link code: <span className="select-all font-mono text-slate-200">{push.token}</span>
            <br />
            On the other device, open Settings and paste this code below.
          </p>
        ) : (
          <div className="mt-2 flex gap-2">
            <input
              id="link-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Link code from your phone"
              className="min-w-0 flex-1 rounded-md bg-slate-800 px-2 py-1 font-mono ring-1 ring-slate-700"
            />
            <button onClick={() => code && (linkWithCode(code), setMsg('Linked. Team times from the relay will show here.'))} className="rounded-md bg-slate-800 px-2.5 ring-1 ring-slate-700">
              Link
            </button>
          </div>
        )}
      </details>
    </section>
  )
}
