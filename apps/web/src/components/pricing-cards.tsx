import Link from 'next/link'
import { PLANS, formatEur, type PlanId } from '@freshphone/shared'
import { cn } from '@/lib/cn'
import { getDict } from '@/i18n/get-dict'

const paid: PlanId[] = ['monthly', 'sixmonth', 'yearly', 'lifetime']

export async function PricingCards() {
  const { t } = await getDict()
  const ui = t.planUi

  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
      {paid.map((id) => {
        const p = PLANS[id]
        const plan = t.plans[id]
        const pop = p.popular
        const interval =
          p.interval === 'month' ? ui.perMonth : p.interval === '6month' ? ui.perSix : p.interval === 'year' ? ui.perYear : ui.once
        return (
          <div
            key={id}
            className={cn(
              'relative flex flex-col rounded-xl2 bg-surface p-6 shadow-sm transition-transform hover:-translate-y-1',
              pop ? 'border-2 border-brand' : 'border border-line',
            )}
          >
            {pop && (
              <span className="bg-grad absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-semibold text-white">{ui.popular}</span>
            )}
            <h3 className="font-display text-lg font-semibold">{plan.name}</h3>
            <p className="mt-1 text-sm text-ink2">{plan.tagline}</p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="font-display text-3xl font-bold">{formatEur(p.priceEur)}</span>
              <span className="text-sm text-ink2">{interval}</span>
            </div>
            <ul className="mt-5 flex-1 divide-y divide-line border-y border-line text-sm">
              {plan.features.map((f) => (
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
              {ui.choose} {plan.name}
            </Link>
          </div>
        )
      })}
    </div>
  )
}

export async function FreeBanner() {
  const { t } = await getDict()
  const ui = t.planUi
  return (
    <div className="rounded-xl2 border border-line bg-grad-soft p-6 sm:flex sm:items-center sm:justify-between">
      <div>
        <h3 className="font-display text-lg font-semibold">{ui.freeTitle}</h3>
        <p className="mt-1 max-w-xl text-sm text-ink2">{ui.freeText}</p>
      </div>
      <Link
        href="/download"
        className="mt-4 inline-flex shrink-0 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-bg sm:mt-0"
      >
        {ui.freeButton}
      </Link>
    </div>
  )
}
