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
  const [usage, setUsage] = useState<{ licensed: boolean; limit: number | null; used: number; remaining: number | null } | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [licMsg, setLicMsg] = useState<string | null>(null)
  const [activating, setActivating] = useState(false)

  const [ver, setVer] = useState('')
  const [upState, setUpState] = useState<'idle' | 'checking' | 'none' | 'available' | 'downloading' | 'ready' | 'error'>('idle')
  const [upInfo, setUpInfo] = useState<{ version?: string; notes?: string; percent?: number; message?: string }>({})

  useEffect(() => {
    window.fp.settings.get().then((s) => setDemo(Boolean((s as { demo?: boolean }).demo)))
    const load = (): void => {
      window.fp.license.status().then((s) => setLic(s))
      window.fp.license.usage().then(setUsage).catch(() => undefined)
    }
    load()
    return window.fp.license.onChanged(() => load())
  }, [])

  useEffect(() => {
    window.fp.updates.version().then(setVer).catch(() => undefined)
    return window.fp.updates.onEvent((e) => {
      if (e.type === 'available') {
        setUpState('available')
        setUpInfo({ version: e.version, notes: e.notes })
      } else if (e.type === 'none') {
        setUpState('none')
      } else if (e.type === 'progress') {
        setUpState('downloading')
        setUpInfo((p) => ({ ...p, percent: e.percent }))
      } else if (e.type === 'downloaded') {
        setUpState('ready')
      } else if (e.type === 'error') {
        // "No published versions" ecc. = nessuna release pubblicata = nessun aggiornamento
        if (/no published|latest|404|not found/i.test(e.message ?? '')) setUpState('none')
        else {
          setUpState('error')
          setUpInfo({ message: e.message })
        }
      }
    })
  }, [])

  async function checkUpdates() {
    setUpState('checking')
    const r = await window.fp.updates.check()
    if (r.dev) {
      setUpState('error')
      setUpInfo({ message: 'Gli aggiornamenti sono disponibili solo nell’app installata (non in sviluppo).' })
    } else if (!r.ok && r.message && !/no published|latest|404/i.test(r.message)) {
      setUpState('error')
      setUpInfo({ message: r.message })
    }
  }

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
          Modalità demo (dati di esempio senza telefono)
        </label>
        <p className="mt-2 text-xs text-ink2">
          Disattivala per usare il telefono reale (rilevamento automatico al collegamento). Per iPhone i driver Apple
          vengono installati dall’installer; se il telefono non viene visto, controlla cavo e autorizzazione.
        </p>
      </div>

      <div className="mt-4 rounded-xl2 border border-line bg-surface p-5">
        <h2 className="font-display font-semibold">Licenza</h2>
        <p className="mt-2 text-sm text-ink2">{licLine}</p>
        {lic.state !== 'active' && usage && !usage.licensed && usage.limit != null && (
          <p className="mt-1 text-xs text-ink2">
            Versione gratuita: {usage.used}/{usage.limit} file esportati
            {usage.remaining === 0 ? ' — limite raggiunto' : ` · ${usage.remaining} rimanenti`}
          </p>
        )}
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

      <div className="mt-4 rounded-xl2 border border-line bg-surface p-5">
        <h2 className="font-display font-semibold">Aggiornamenti</h2>
        <p className="mt-2 text-sm text-ink2">Versione attuale: {ver || '…'}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={checkUpdates}
            disabled={upState === 'checking' || upState === 'downloading'}
            className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-bg disabled:opacity-60"
          >
            {upState === 'checking' ? 'Controllo…' : 'Cerca aggiornamenti'}
          </button>
          {upState === 'available' && (
            <button onClick={() => void window.fp.updates.download()} className="bg-grad rounded-lg px-4 py-2 text-sm font-semibold text-white">
              Scarica {upInfo.version}
            </button>
          )}
          {upState === 'downloading' && <span className="text-sm text-ink2">Download… {upInfo.percent ?? 0}%</span>}
          {upState === 'ready' && (
            <button onClick={() => void window.fp.updates.install()} className="bg-grad rounded-lg px-4 py-2 text-sm font-semibold text-white">
              Aggiorna e riavvia
            </button>
          )}
        </div>
        {upState === 'none' && <p className="mt-2 text-xs text-ink2">Sei già all’ultima versione.</p>}
        {upState === 'available' && upInfo.notes && <p className="mt-2 whitespace-pre-line text-xs text-ink2">{upInfo.notes}</p>}
        {upState === 'error' && <p className="mt-2 text-xs text-ink2">{upInfo.message}</p>}
      </div>

      <p className="mt-6 text-xs text-ink2">FreshPhone · versione {ver || '0.1.0'}</p>
    </div>
  )
}
