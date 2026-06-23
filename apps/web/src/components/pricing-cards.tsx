import Link from 'next/link'
import { PLANS, formatEur, type PlanId } from '@freshphone/shared'
import { cn } from '@/lib/cn'

const intervalLabel: Record<string, string> = {
  month: '/mese',
  '6month': '/6 mesi',
  year: '/anno',
  once: ' una tantum',
}

const planFeatures: Record<PlanId, string[]> = {
  free: ['Sfoglia foto, video e file', 'Anteprime e metadati', 'Ordina e filtra', 'Export fino a 50 file'],
  monthly: ['Tutte le funzioni', 'Export illimitato', 'Metadati sempre intatti', 'Libera spazio in sicurezza'],
  sixmonth: ['Tutto del piano Mensile', 'Risparmio del 36%', 'Aggiornamenti inclusi'],
  yearly: ['Tutto del piano 6 mesi', 'Miglior prezzo al mese', 'Supporto prioritario', 'Aggiornamenti inclusi'],
  lifetime: ['Tutte le funzioni, per sempre', 'Aggiornamenti major line', 'Supporto prioritario', 'Licenza per 1 PC'],
}

const paid: PlanId[] = ['monthly', 'sixmonth', 'yearly', 'lifetime']

export function PricingCards() {
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
      {paid.map((id) => {
        const p = PLANS[id]
        const pop = p.popular
        return (
          <div
            key={id}
            className={cn(
              'relative flex flex-col rounded-xl2 bg-surface p-6 shadow-sm transition-transform hover:-translate-y-1',
              pop ? 'border-2 border-brand' : 'border border-line',
            )}
          >
            {pop && (
              <span className="bg-grad absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-semibold text-white">
                Più popolare
              </span>
            )}
            <h3 className="font-display text-lg font-semibold">{p.name}</h3>
            <p className="mt-1 text-sm text-ink2">{p.tagline}</p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="font-display text-3xl font-bold">{formatEur(p.priceEur)}</span>
              <span className="text-sm text-ink2">{intervalLabel[p.interval ?? 'once']}</span>
            </div>
            <ul className="mt-5 flex-1 divide-y divide-line border-y border-line text-sm">
              {planFeatures[id].map((f) => (
                <li key={f} className="py-2.5 text-ink2">
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href={`/checkout?plan=${id}`}
              className={cn(
                'mt-6 rounded-full px-4 py-2.5 text-center text-sm font-semibold transition-colors',
                pop ? 'bg-grad text-white hover:brightness-110' : 'border border-line text-ink hover:bg-bg',
              )}
            >
              Scegli {p.name}
            </Link>
          </div>
        )
      })}
    </div>
  )
}

export function FreeBanner() {
  const p = PLANS.free
  return (
    <div className="rounded-xl2 border border-line bg-grad-soft p-6 sm:flex sm:items-center sm:justify-between">
      <div>
        <h3 className="font-display text-lg font-semibold">Prova gratis, senza scadenza</h3>
        <p className="mt-1 max-w-xl text-sm text-ink2">
          Connetti l'iPhone, sfoglia tutto con anteprime, ordina e filtra. Esporta fino a {p.exportLimit} file senza
          pagare nulla.
        </p>
      </div>
      <Link
        href="/download"
        className="mt-4 inline-flex shrink-0 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-bg sm:mt-0"
      >
        Scarica gratis
      </Link>
    </div>
  )
}
