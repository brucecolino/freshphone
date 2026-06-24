import { useState, type ReactNode } from 'react'
import { useDevice } from '../store/device'
import type { NavKey } from '../components/sidebar'

const gb = (b?: number) => `${((b ?? 0) / 1_000_000_000).toFixed(1)} GB`

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl2 border border-line bg-surface p-5">
      <p className="text-xs text-ink2">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  )
}

function Banner({ children }: { children: ReactNode }) {
  return <div className="mt-4 rounded-xl2 border border-line bg-grad-soft p-4 text-sm">{children}</div>
}

export function Home({ onNavigate }: { onNavigate: (k: NavKey) => void }) {
  const status = useDevice((s) => s.status)
  const refresh = useDevice((s) => s.refresh)
  const [pairing, setPairing] = useState(false)
  const [driverMsg, setDriverMsg] = useState<string | null>(null)

  async function authorize() {
    setPairing(true)
    try {
      await window.fp.device.pair()
    } finally {
      setPairing(false)
      void refresh()
    }
  }

  async function installDriver() {
    const r = await window.fp.driver.install()
    setDriverMsg(r.message)
  }

  const free = status?.usedBytes && status?.totalBytes ? status.totalBytes - status.usedBytes : undefined
  const ready = status?.mode === 'demo' || (status?.connected === true && status?.trusted === true)

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Home</h1>
      <p className="mt-1 text-sm text-ink2">
        {status?.mode === 'demo'
          ? 'Modalità demo'
          : status?.connected
            ? `${status.name ?? 'iPhone'} collegato`
            : 'Nessun iPhone collegato — ricerca in corso…'}
      </p>

      {status?.mode === 'none' && status.toolsOk === false && (
        <Banner>
          <p className="font-medium">Strumenti dispositivo non trovati</p>
          <p className="mt-1 text-ink2">
            Manca <code>pymobiledevice3</code> in <code>resources/bin</code>. Reinstalla FreshPhone, oppure attiva la
            modalità demo in Impostazioni per provare l’interfaccia.
          </p>
        </Banner>
      )}

      {status?.mode === 'none' && status.toolsOk !== false && (
        <Banner>
          <p className="font-medium">Sto cercando l’iPhone…</p>
          <p className="mt-1 text-ink2">
            Collegalo con un <strong>cavo dati</strong> (preferibilmente quello originale Apple, non un cavo solo
            ricarica), direttamente a una porta USB del PC. Poi <strong>sblocca</strong> il telefono e, alla richiesta,
            tocca <strong>Autorizza</strong>. Il collegamento viene rilevato in automatico.
          </p>
          <button
            onClick={installDriver}
            className="mt-3 rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-semibold hover:bg-bg"
          >
            Reinstalla driver Apple
          </button>
          {driverMsg && <p className="mt-2 text-xs text-ink2">{driverMsg}</p>}
        </Banner>
      )}

      {status?.connected && !status.trusted && (
        <Banner>
          <span>iPhone collegato. Sblocca il telefono e tocca “Autorizza”, poi premi qui.</span>
          <button
            onClick={authorize}
            disabled={pairing}
            className="bg-grad ml-3 rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {pairing ? 'Attendo…' : 'Autorizza'}
          </button>
        </Banner>
      )}

      {ready && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Card label="Spazio usato" value={gb(status?.usedBytes)} />
            <Card label="Spazio libero" value={gb(free)} />
            <Card label="Capacità" value={gb(status?.totalBytes)} />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => onNavigate('photos')} className="bg-grad rounded-full px-5 py-2.5 text-sm font-semibold text-white">
              Sfoglia foto e video
            </button>
            <button onClick={() => onNavigate('files')} className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold hover:bg-surface">
              Sfoglia file
            </button>
            <button onClick={() => onNavigate('spazio')} className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold hover:bg-surface">
              Libera spazio
            </button>
          </div>
        </>
      )}
    </div>
  )
}
