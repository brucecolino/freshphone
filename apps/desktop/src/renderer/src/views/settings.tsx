import { useEffect, useState } from 'react'
import { useTheme } from '../store/theme'
import { cn } from '../lib/cn'

const modes = [
  { k: 'system', label: 'Sistema' },
  { k: 'light', label: 'Chiaro' },
  { k: 'dark', label: 'Scuro' },
] as const

interface Lic {
  state: string
  plan?: string
  expiresAt?: string | null
}

export function Settings() {
  const source = useTheme((s) => s.source)
  const setSource = useTheme((s) => s.setSource)
  const [demo, setDemo] = useState(false)

  const [lic, setLic] = useState<Lic>({ state: 'none' })
  const [keyInput, setKeyInput] = useState('')
  const [licMsg, setLicMsg] = useState<string | null>(null)
  const [activating, setActivating] = useState(false)

  useEffect(() => {
    window.fp.settings.get().then((s) => setDemo(Boolean((s as { demo?: boolean }).demo)))
    window.fp.license.status().then((s) => setLic(s))
    return window.fp.license.onChanged((s) => setLic(s))
  }, [])

  async function toggleDemo(v: boolean) {
    setDemo(v)
    await window.fp.settings.set({ demo: v })
    location.reload()
  }

  async function doActivate() {
    setActivating(true)
    setLicMsg(null)
    try {
      const r = await window.fp.license.activate(keyInput)
      setLicMsg(r.message)
      setLic(await window.fp.license.status())
      if (r.ok) setKeyInput('')
    } finally {
      setActivating(false)
    }
  }

  async function doDeactivate() {
    setLic(await window.fp.license.deactivate())
    setLicMsg('Licenza rimossa')
  }

  const licLine =
    lic.state === 'active'
      ? `Attiva${lic.plan && lic.plan !== 'unknown' ? ` · piano ${lic.plan}` : ''}${lic.expiresAt ? ` · scade il ${new Date(lic.expiresAt).toLocaleDateString('it-IT')}` : ' · a vita'}`
      : lic.state === 'expired'
        ? 'Licenza scaduta'
        : 'Nessuna licenza attiva'

  return (
    <div className="max-w-2xl p-6">
      <h1 className="text-2xl font-bold">Impostazioni</h1>

      <div className="mt-6 rounded-xl2 border border-line bg-surface p-5">
        <h2 className="font-display font-semibold">Tema</h2>
        <div className="mt-3 flex gap-2">
          {modes.map((m) => (
            <button
              key={m.k}
              onClick={() => void setSource(m.k)}
              className={cn(
                'rounded-lg border px-4 py-2 text-sm transition-colors',
                source === m.k ? 'border-transparent bg-pill font-medium text-pillt' : 'border-line text-ink2 hover:text-ink',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl2 border border-line bg-surface p-5">
        <h2 className="font-display font-semibold">Dispositivo</h2>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={demo} onChange={(e) => void toggleDemo(e.target.checked)} />
          Modalità demo (dati di esempio senza iPhone)
        </label>
        <p className="mt-2 text-xs text-ink2">
          Disattivala per usare l’iPhone reale: servono i binari libimobiledevice in <code>resources/bin</code> e
          l’Apple Mobile Device Driver.
        </p>
      </div>

      <div className="mt-4 rounded-xl2 border border-line bg-surface p-5">
        <h2 className="font-display font-semibold">Licenza</h2>
        <p className="mt-2 text-sm text-ink2">{licLine}</p>
        {lic.state === 'active' ? (
          <button onClick={doDeactivate} className="mt-3 rounded-lg border border-line px-4 py-2 text-sm hover:bg-bg">
            Disattiva
          </button>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="FP-XXXX-XXXX-XXXX-XXXX"
              className="w-full max-w-xs rounded-lg border border-line bg-bg px-3 py-2 text-sm uppercase outline-none focus:border-brand"
            />
            <button
              onClick={doActivate}
              disabled={activating}
              className="bg-grad rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {activating ? 'Attivo…' : 'Attiva'}
            </button>
          </div>
        )}
        {licMsg && <p className="mt-2 text-xs text-ink2">{licMsg}</p>}
        <p className="mt-3 text-xs text-ink2">
          Puoi anche attivare con un clic dall’area personale sul sito (link <code>freshphone://</code>).
        </p>
      </div>

      <p className="mt-6 text-xs text-ink2">FreshPhone · versione 0.1.0</p>
    </div>
  )
}
