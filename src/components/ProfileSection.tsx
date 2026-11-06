import { useState } from 'react'
import { account, deleteProfile, signIn, signOut, syncNow } from '../lib/account'
import { fmtRelative } from '../lib/format'

export default function ProfileSection() {
  const a = account.use()
  const [mode, setMode] = useState<'signin' | 'create'>('signin')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      await signIn(username, password, mode === 'create')
      setPassword('')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (a.username && a.token)
    return (
      <section className="px-4 py-3">
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Profile</h3>
        <div className="flex items-center gap-3 rounded-lg bg-slate-800/60 p-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500 text-lg font-bold uppercase text-slate-950">{a.username[0]}</span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{a.username}</div>
            <div className="text-xs text-slate-400">
              {a.syncing ? 'Saving…' : a.error ? <span className="text-red-300">{a.error}</span> : a.lastSync ? `Logbook, teams and emergencies saved ${fmtRelative(a.lastSync)}` : 'Not saved yet'}
            </div>
          </div>
          <button onClick={() => syncNow()} disabled={a.syncing} className="shrink-0 rounded-md bg-slate-700 px-2.5 py-1 text-xs disabled:opacity-50">
            Sync now
          </button>
        </div>
        <div className="mt-2 flex gap-2 text-xs">
          <button onClick={() => signOut()} className="rounded-md px-3 py-1.5 text-slate-300 ring-1 ring-slate-700">
            Sign out
          </button>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} className="ml-auto rounded-md px-3 py-1.5 text-slate-500 hover:text-red-300">
              Delete profile…
            </button>
          ) : (
            <span className="ml-auto flex items-center gap-2 text-red-300">
              Delete it and its saved data?
              <button onClick={() => deleteProfile().catch((err) => setMsg(String(err)))} className="rounded-md bg-red-500 px-2.5 py-1 font-semibold text-white">
                Delete
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-slate-400">
                Keep
              </button>
            </span>
          )}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Signing out keeps everything on this device. Sign in on any other device to get it there too.</p>
        {msg && <p className="mt-1 text-xs text-red-300">{msg}</p>}
      </section>
    )

  return (
    <section className="px-4 py-3">
      <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Profile</h3>
      <p className="mb-2 text-xs text-slate-500">
        Sign in to keep your logbook, teams and emergency history safe, and to get them on every device.
      </p>
      <div className="mb-2 flex overflow-hidden rounded-md text-xs font-semibold ring-1 ring-slate-700">
        {(['signin', 'create'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`flex-1 py-1.5 ${mode === m ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>
            {m === 'signin' ? 'Sign in' : 'Create profile'}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-2">
        <input
          id="profile-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          className="w-full rounded-md bg-slate-800 px-3 py-2 text-sm ring-1 ring-slate-700 placeholder:text-slate-500"
        />
        <input
          id="profile-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === 'create' ? 'Password (8+ characters)' : 'Password'}
          autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
          className="w-full rounded-md bg-slate-800 px-3 py-2 text-sm ring-1 ring-slate-700 placeholder:text-slate-500"
        />
        <button type="submit" disabled={busy || !username || !password} className="w-full rounded-md bg-sky-500 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40">
          {busy ? 'One moment…' : mode === 'create' ? 'Create profile' : 'Sign in'}
        </button>
      </form>
      {mode === 'create' && <p className="mt-2 text-[11px] text-slate-500">There's no email reset, so pick a password you'll remember (your iPhone can save it for you).</p>}
      {msg && <p className="mt-2 text-xs text-red-300">{msg}</p>}
    </section>
  )
}
