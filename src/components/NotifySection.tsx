import { useEffect, useState } from 'react'
import { settings, type Settings } from '../lib/settings'
import { disablePush, enablePush, linkWithCode, pullRelayState, pushStore, pushSupport, runCheckNow, sendTestPush, syncPushConfig, type RelayStatus } from '../lib/push'
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
  const [relay, setRelay] = useState<RelayStatus | null>(null)
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
        <RelayStatusBox relay={relay} />
      ) : !support.ok ? (
        <div className="mb-2 rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-200">{support.reason}</div>
      ) : null}

      <div className="divide-y divide-slate-800">
        <Check k="notifyTeams" label="🛫 Team planes take off or land" />
        <Check k="notifyEmergencies" label="⚠️ Emergencies" />
        {s.notifyEmergencies && (
          <>
            <div className="flex items-center justify-between gap-3 py-2 text-sm">
              Where
              <div className="flex overflow-hidden rounded-md text-xs font-semibold ring-1 ring-slate-700">
                {(
                  [
                    ['near', 'Near home'],
                    ['world', 'Anywhere in the world'],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => settings.update({ emergencyScope: v })}
                    className={`px-2.5 py-1 ${s.emergencyScope === v ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <Check k="include7600" label="📻 Include radio failures (7600)" />
            <p className="pb-2 text-[11px] text-slate-500">
              {s.emergencyScope === 'world'
                ? 'Every new 7700 (and 7500 hijack) worldwide. Expect a few an hour; you get at most 3 per check, and never the same plane twice in 6 hours.'
                : 'Hijacks (7500) and emergencies (7700) within the distance below.'}{' '}
              Radio failures are common and usually minor.
            </p>
          </>
        )}
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
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await syncPushConfig()
                  const r = await sendTestPush()
                  if (!r.sent) throw new Error(`The relay couldn't reach this phone${r.errors?.length ? `: ${r.errors[0]}` : ''}. Try "Turn off", then turn notifications on again.`)
                }, 'Test sent. It should arrive in a few seconds.')
              }
              className="flex-1 rounded-md bg-sky-500 py-2 text-sm font-semibold text-slate-950"
            >
              Send a test
            </button>
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await syncPushConfig()
                  const r = await runCheckNow()
                  setRelay((x) => ({ ...x, ...r, lastRun: r.lastCheck?.at }))
                  if (r.lastCheck?.errors.length) throw new Error(`Check ran with problems: ${r.lastCheck.errors.join('; ')}`)
                }, 'Check finished. Results are shown above.')
              }
              className="rounded-md px-3 py-2 text-sm text-sky-300 ring-1 ring-slate-700"
            >
              Run a check
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

function RelayStatusBox({ relay }: { relay: RelayStatus | null }) {
  const c = relay?.lastCheck
  const stale = relay?.lastRun ? Date.now() - relay.lastRun > 20 * 60 * 1000 : true
  const bad = !c || stale || c.errors.length > 0 || c.pushErrors.length > 0
  return (
    <div className={`mb-2 space-y-0.5 rounded-lg px-3 py-2 text-xs ${bad ? 'bg-amber-400/10 text-amber-100' : 'bg-emerald-500/10 text-emerald-300'}`}>
      <div>On for this device{relay?.devices != null ? ` · ${relay.devices} phone${relay.devices === 1 ? '' : 's'} linked` : ''}.</div>
      {!relay?.lastRun ? (
        <div>No background check has run yet. Make sure the relay has its 5-minute cron trigger, then tap "Run a check".</div>
      ) : (
        <div>
          Last background check {fmtRelative(relay.lastRun)} ({fmtClock(relay.lastRun)}){c ? `: looked at ${c.steps.join(', ') || 'nothing'}` : ''}.
          {stale && ' That was a while ago: check the relay\'s cron trigger.'}
        </div>
      )}
      {relay?.today && (
        <div>
          Today: {relay.today.runs} checks, {relay.today.alerts} alerts found, {relay.today.sent} sent to your phone.
        </div>
      )}
      {c?.errors.map((e) => (
        <div key={e} className="text-red-300">
          ⚠ {e}
        </div>
      ))}
      {c?.pushErrors.map((e) => (
        <div key={e} className="text-red-300">
          ⚠ Couldn't deliver: {e}
        </div>
      ))}
    </div>
  )
}
