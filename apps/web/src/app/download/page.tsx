import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Download — FreshPhone',
  description: 'Scarica FreshPhone per Windows 10 e 11. Gratis, con export fino a 50 file.',
}

const reqs = [
  'Windows 10 o 11 (64-bit)',
  'iPhone con cavo USB, nessun jailbreak',
  'Driver installati in automatico al primo avvio',
]

export default function DownloadPage() {
  return (
    <section className="container-x py-16 md:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold sm:text-5xl">Scarica FreshPhone</h1>
        <p className="mt-4 text-ink2">
          Gratis per Windows. Sfoglia tutto, ordina e filtra, ed esporta fino a 50 file senza pagare.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href="https://github.com/brucecolino/fresphone/releases"
            className="bg-grad inline-flex items-center rounded-full px-7 py-3.5 text-sm font-semibold text-white transition-[filter] hover:brightness-110"
          >
            Scarica per Windows (.exe)
          </Link>
          <span className="text-xs text-ink2">L’installer sarà disponibile alla prima release · ~120 MB</span>
        </div>
      </div>

      <div className="mx-auto mt-14 max-w-xl rounded-xl2 border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-semibold">Requisiti</h2>
        <ul className="mt-4 divide-y divide-line border-t border-line text-sm">
          {reqs.map((r) => (
            <li key={r} className="py-3 text-ink2">
              {r}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
