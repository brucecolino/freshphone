import { useEffect } from 'react'
import { useDevice } from '../store/device'
import { useLibrary } from '../store/library'

const gb = (b: number) => `${(b / 1_000_000_000).toFixed(1)} GB`

// Colori dei segmenti (palette brand): foto blu, video teal, altro ambra.
const SEG = { photo: '#2C6E9C', video: '#29A99B', other: '#C9A227' }

export function Spazio() {
  const status = useDevice((s) => s.status)
  const ready = status?.mode === 'demo' || (status?.connected === true && status?.trusted === true)
  const items = useLibrary((s) => s.items)
  const loading = useLibrary((s) => s.loading)
  const ensureLib = useLibrary((s) => s.ensure)

  useEffect(() => {
    if (ready) ensureLib()
  }, [ready, ensureLib])

  const total = status?.totalBytes ?? 0
  const used = status?.usedBytes ?? 0
  const free = Math.max(0, total - used)

  let photoBytes = 0
  let videoBytes = 0
  let photoCount = 0
  let videoCount = 0
  for (const it of items) {
    if (it.type === 'video') {
      videoBytes += it.sizeBytes
      videoCount++
    } else if (it.type === 'photo') {
      photoBytes += it.sizeBytes
      photoCount++
    }
  }
  const cameraBytes = photoBytes + videoBytes
  const otherBytes = Math.max(0, used - cameraBytes) // app, sistema, altri media
  const pctOf = (b: number) => (total ? (b / total) * 100 : 0)

  const rows: { color: string; label: string; count?: number; bytes: number; free?: boolean }[] = [
    { color: SEG.photo, label: 'Foto', count: photoCount, bytes: photoBytes },
    { color: SEG.video, label: 'Video', count: videoCount, bytes: videoBytes },
    { color: SEG.other, label: 'Altro (app e sistema)', bytes: otherBytes },
    { color: 'transparent', label: 'Libero', bytes: free, free: true },
  ]

  return (
    <div className="max-w-2xl p-6">
      <h1 className="text-2xl font-bold">Spazio</h1>
      <p className="mt-1 text-sm text-ink2">Cosa occupa lo spazio del telefono. Libera spazio spostando foto e video sul PC.</p>

      {!ready ? (
        <p className="mt-6 text-sm text-ink2">Collega e sblocca il telefono per vedere lo spazio.</p>
      ) : (
        <>
          <div className="mt-6 rounded-xl2 border border-line bg-surface p-6">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{gb(used)} usati</span>
              <span className="text-ink2">
                {gb(free)} liberi su {gb(total)}
              </span>
            </div>
            <div className="mt-3 flex h-4 w-full overflow-hidden rounded-full bg-line">
              <div style={{ width: `${pctOf(photoBytes)}%`, backgroundColor: SEG.photo }} />
              <div style={{ width: `${pctOf(videoBytes)}%`, backgroundColor: SEG.video }} />
              <div style={{ width: `${pctOf(otherBytes)}%`, backgroundColor: SEG.other }} />
            </div>
            {loading && cameraBytes === 0 && <p className="mt-2 text-xs text-ink2">Calcolo della libreria in corso…</p>}
          </div>

          <div className="mt-4 divide-y divide-line overflow-hidden rounded-xl2 border border-line bg-surface">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center gap-3 px-5 py-3">
                <span className="h-3 w-3 shrink-0 rounded-full border border-line" style={{ backgroundColor: r.free ? 'transparent' : r.color }} />
                <span className="flex-1 text-sm">{r.label}</span>
                {r.count != null && <span className="text-xs text-ink2">{r.count} elementi</span>}
                <span className="w-24 text-right text-sm font-medium">{gb(r.bytes)}</span>
              </div>
            ))}
            <div className="flex items-center gap-3 bg-bg/40 px-5 py-3">
              <span className="h-3 w-3 shrink-0" />
              <span className="flex-1 text-sm font-semibold">Capacità totale</span>
              <span className="w-24 text-right text-sm font-semibold">{gb(total)}</span>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-line bg-bg/40 p-3 text-xs text-ink2">
            <p className="font-medium text-ink">Nota sullo spazio</p>
            <p className="mt-1">
              Dopo aver eliminato o spostato file, <strong>riavvia il telefono</strong> per vedere lo spazio liberato:
              alcuni telefoni (come iPhone) aggiornano il conteggio dello spazio solo al riavvio, anche se i file sono già stati rimossi.
            </p>
          </div>
          <p className="mt-3 text-xs text-ink2">
            “Altro” comprende app, sistema e media non nel rullino (non accessibili via USB). Foto e Video sono calcolati dai file reali del rullino.
          </p>
        </>
      )}
    </div>
  )
}
