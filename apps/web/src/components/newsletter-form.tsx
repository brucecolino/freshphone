'use client'

import { useState } from 'react'

type State = 'idle' | 'loading' | 'done' | 'error'

export function NewsletterForm({ locale = 'it' }: { locale?: 'it' | 'en' }) {
  const s =
    locale === 'en'
      ? {
          email: 'Your email',
          subscribe: 'Subscribe',
          wait: 'Please wait…',
          already: 'You are already subscribed.',
          check: 'Check your email to confirm.',
          err: 'Something went wrong.',
          net: 'Network error. Try again.',
        }
      : {
          email: 'La tua email',
          subscribe: 'Iscriviti',
          wait: 'Attendi…',
          already: 'Sei già iscritto.',
          check: 'Controlla la tua email per confermare.',
          err: 'Si è verificato un errore.',
          net: 'Errore di rete. Riprova.',
        }

  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>('idle')
  const [msg, setMsg] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState('loading')
    setMsg('')
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = (await res.json()) as { ok?: boolean; already?: boolean; error?: string }
      if (!res.ok) {
        setState('error')
        setMsg(data.error ?? s.err)
        return
      }
      setState('done')
      setMsg(data.already ? s.already : s.check)
    } catch {
      setState('error')
      setMsg(s.net)
    }
  }

  if (state === 'done') {
    return <p className="text-sm text-ink2">{msg}</p>
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={s.email}
        className="flex-1 rounded-full border border-line bg-bg px-4 py-2.5 text-sm outline-none focus:border-brand"
      />
      <button
        type="submit"
        disabled={state === 'loading'}
        className="bg-grad rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {state === 'loading' ? s.wait : s.subscribe}
      </button>
      {state === 'error' && <p className="text-sm text-ink2 sm:hidden">{msg}</p>}
    </form>
  )
}
