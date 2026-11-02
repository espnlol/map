import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

function phoneUrls(): string[] {
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname)
  if (!local) return [location.origin]
  const port = location.port ? `:${location.port}` : ''
  return __LAN_ADDRESSES__.map((ip) => `http://${ip}${port}`)
}

export default function PhoneGuide({ onClose }: { onClose: () => void }) {
  const urls = phoneUrls()
  const [idx, setIdx] = useState(0)
  const [qr, setQr] = useState<string | null>(null)
  const url = urls[idx]
  const onPhoneAlready = !['localhost', '127.0.0.1'].includes(location.hostname)

  useEffect(() => {
    if (!url) return
    QRCode.toDataURL(url, { width: 240, margin: 1, color: { dark: '#020617', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(null))
  }, [url])

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-full w-full max-w-md flex-col overflow-y-auto rounded-xl bg-slate-900 ring-1 ring-slate-700"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Use SkyWatch on your phone"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 p-4">
          <h2 className="text-lg font-bold">Use SkyWatch on your phone</h2>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="space-y-4 p-4 text-sm">
          {!onPhoneAlready && (
            <>
              {url ? (
                <div className="flex flex-col items-center gap-2">
                  {qr && <img src={qr} alt="QR code for SkyWatch" className="h-56 w-56 rounded-lg" />}
                  <div className="select-all font-mono text-base text-sky-300">{url}</div>
                  {urls.length > 1 && (
                    <button className="text-xs text-slate-400 underline" onClick={() => setIdx((idx + 1) % urls.length)}>
                      Didn't work? Try another address ({idx + 1} of {urls.length})
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-amber-300">This computer doesn't seem to be on a Wi-Fi or home network right now.</p>
              )}
              <ol className="list-decimal space-y-1.5 pl-5 text-slate-300">
                <li>Make sure your iPhone is on the <b>same Wi-Fi</b> as this computer.</li>
                <li>Open the iPhone <b>Camera</b> and point it at the QR code.</li>
                <li>Tap the yellow link that pops up. SkyWatch opens in Safari.</li>
                <li>
                  Tap the <b>Share</b> button (square with an arrow), scroll down, tap <b>Add to Home Screen</b>, then <b>Add</b>.
                </li>
              </ol>
            </>
          )}
          {onPhoneAlready && (
            <ol className="list-decimal space-y-1.5 pl-5 text-slate-300">
              <li>
                Tap Safari's <b>Share</b> button (square with an arrow).
              </li>
              <li>
                Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.
              </li>
              <li>Open SkyWatch from its new icon. It runs full screen like an app.</li>
            </ol>
          )}
          <div className="space-y-1.5 rounded-lg bg-slate-800/60 p-3 text-xs text-slate-400">
            <p>
              <b className="text-slate-200">Your computer has to be on</b> with the Start SkyWatch window open, and your phone on
              the same Wi-Fi. Away from home it won't load.
            </p>
            <p>
              <b className="text-slate-200">Phone can't connect?</b> Windows may be blocking it. Open the Windows Start menu, search
              "Allow an app through Windows Firewall", click <i>Change settings</i>, and tick both boxes next to{' '}
              <i>Node.js JavaScript Runtime</i>.
            </p>
            <p>
              <b className="text-slate-200">"Near me" doesn't work on the phone</b> in this setup (iPhones only share location with
              secure websites). Pick an airport from the list or pan the map and tap <i>Track planes here</i>. SkyWatch remembers
              your last spot.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
