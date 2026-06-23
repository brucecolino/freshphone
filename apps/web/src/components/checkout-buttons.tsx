'use client'

import { useState } from 'react'

export function CheckoutButtons({ plan }: { plan: string }) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function buy(provider: 'stripe' | 'paypal') {
    setError(null)
    setLoading(provider)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, provider }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Si è verificato un errore.')
        setLoading(null)
        return
      }
      window.location.href = data.url
    } catch {
      setError('Errore di rete. Riprova.')
      setLoading(null)
    }
  }

  return (
    <div className="mt-6 space-y-3">
      <button
        onClick={() => buy('stripe')}
        disabled={loading !== null}
        className="bg-grad w-full rounded-full px-4 py-3 text-sm font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-60"
      >
        {loading === 'stripe' ? 'Attendi…' : 'Paga con carta (Stripe)'}
      </button>
      <button
        onClick={() => buy('paypal')}
        disabled={loading !== null}
        className="w-full rounded-full border border-line px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-bg disabled:opacity-60"
      >
        Paga con PayPal
      </button>
      {error && <p className="text-sm text-ink2">{error}</p>}
    </div>
  )
}
