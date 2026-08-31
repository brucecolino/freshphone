import { useEffect, useState } from 'react'

// Log diagnostico (dettagli tecnici: scansione libreria, cartelle non lette, iCloud…).
// Vive qui perché serve sia dalla Home (stato "errore") sia dalle Impostazioni.
export function LogModal({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('Caricamento…')
  useEffect(() => {
    let alive = true
    window.fp.log.get().then((t) => {
      if (alive) setText(t)
    })
    return () => {
      alive = false
    }
  }, [])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={onClose}>
      <div className="flex max-h-full w-full max-w-2xl flex-col rounded-xl2 border border-line bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display font-semibold">Log diagnostico</h2>
          <div className="flex gap-2">
            <button onClick={() => navigator.clipboard.writeText(text)} className="rounded-lg border border-line px-3 py-1 text-sm hover:bg-bg">
              Copia
            </button>
            <button onClick={() => window.fp.log.open()} className="rounded-lg border border-line px-3 py-1 text-sm hover:bg-bg">
              Apri file
            </button>
            <button onClick={onClose} className="rounded-lg border border-line px-3 py-1 text-sm hover:bg-bg">
              Chiudi
            </button>
          </div>
        </div>
        <pre className="mt-3 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg bg-bg p-3 text-xs text-ink2">{text}</pre>
      </div>
    </div>
  )
}
