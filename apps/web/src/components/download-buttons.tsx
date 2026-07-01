'use client'

import { useEffect, useState } from 'react'

// Rileva l'OS e avvia il download diretto dell'installer giusto (via /api/download),
// senza reindirizzare l'utente a GitHub. Il Mac si attiva quando pubblichiamo il .dmg.
export function DownloadButtons({ winLabel }: { winLabel: string }) {
  const [os, setOs] = useState<'win' | 'mac' | 'other'>('other')
  useEffect(() => {
    const ua = navigator.userAgent || ''
    setOs(/Mac|iPhone|iPad/i.test(ua) ? 'mac' : /Windows/i.test(ua) ? 'win' : 'other')
  }, [])

  const MAC_READY = false // attivare quando l'installer .dmg è pubblicato

  return (
    <div className="flex flex-col items-center gap-3">
      {os === 'mac' && MAC_READY ? (
        <a
          href="/api/download?os=mac"
          className="bg-grad inline-flex items-center rounded-full px-7 py-3.5 text-sm font-semibold text-white transition-[filter] hover:brightness-110"
        >
          Scarica per Mac
        </a>
      ) : (
        <a
          href="/api/download?os=win"
          className="bg-grad inline-flex items-center rounded-full px-7 py-3.5 text-sm font-semibold text-white transition-[filter] hover:brightness-110"
        >
          {winLabel}
        </a>
      )}
      <p className="text-xs text-ink2">
        {os === 'mac' && !MAC_READY && 'Rilevato Mac — la versione Mac è in arrivo, intanto puoi scaricare quella Windows. '}
        {os !== 'win' && MAC_READY && (
          <a href="/api/download?os=mac" className="underline hover:text-ink">
            Scarica per Mac
          </a>
        )}
        {os === 'win' && (MAC_READY ? '' : 'Versione Mac in arrivo')}
      </p>
    </div>
  )
}
