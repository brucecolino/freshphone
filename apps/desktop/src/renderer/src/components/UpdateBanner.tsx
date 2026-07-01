import { useEffect, useState } from 'react'

type Phase = 'idle' | 'available' | 'downloading' | 'ready'

// Banner aggiornamenti: avvisa quando c'è una nuova versione, mostra le novità,
// scarica con barra di avanzamento e permette di aggiornare + riavviare.
export function UpdateBanner() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [version, setVersion] = useState('')
  const [notes, setNotes] = useState('')
  const [percent, setPercent] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    return window.fp.updates.onEvent((e) => {
      if (e.type === 'available') {
        setVersion(e.version ?? '')
        setNotes(e.notes ?? '')
        setPhase('available')
        setDismissed(false)
      } else if (e.type === 'progress') {
        setPercent(Math.round(e.percent ?? 0))
        setPhase('downloading')
      } else if (e.type === 'downloaded') {
        setPhase('ready')
      }
      // gli errori (es. nessuna release pubblicata) non mostrano banner: li gestisce
      // la sezione Aggiornamenti nelle Impostazioni.
    })
  }, [])

  if (phase === 'idle' || dismissed) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-xl2 border border-line bg-surface p-4 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold">
          {phase === 'ready' ? 'Aggiornamento pronto' : `Nuova versione ${version} disponibile`}
        </p>
        {phase !== 'downloading' && (
          <button onClick={() => setDismissed(true)} className="text-ink2 hover:text-ink" title="Chiudi">
            ✕
          </button>
        )}
      </div>

      {phase === 'available' && (
        <>
          {notes && <p className="mt-2 max-h-28 overflow-auto whitespace-pre-line text-xs text-ink2">{notes}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setDismissed(true)} className="h-8 rounded-lg border border-line px-3 text-xs hover:bg-bg">
              Più tardi
            </button>
            <button onClick={() => void window.fp.updates.download()} className="bg-grad h-8 rounded-lg px-3 text-xs font-semibold text-white">
              Scarica aggiornamento
            </button>
          </div>
        </>
      )}

      {phase === 'downloading' && (
        <>
          <p className="mt-2 text-xs text-ink2">Download in corso… {percent}%</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
            <div className="bg-grad h-full transition-all" style={{ width: `${percent}%` }} />
          </div>
        </>
      )}

      {phase === 'ready' && (
        <>
          <p className="mt-2 text-xs text-ink2">L’app si riavvierà per applicare la versione {version}.</p>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setDismissed(true)} className="h-8 rounded-lg border border-line px-3 text-xs hover:bg-bg">
              Più tardi
            </button>
            <button onClick={() => void window.fp.updates.install()} className="bg-grad h-8 rounded-lg px-3 text-xs font-semibold text-white">
              Aggiorna e riavvia
            </button>
          </div>
        </>
      )}
    </div>
  )
}
