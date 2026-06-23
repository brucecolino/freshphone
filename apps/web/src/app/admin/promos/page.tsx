import { revalidatePath } from 'next/cache'
import type { PromoType } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin'

export const dynamic = 'force-dynamic'

const fmt = (d: Date) => new Intl.DateTimeFormat('it-IT', { dateStyle: 'short' }).format(d)

async function createPromo(formData: FormData) {
  'use server'
  await requireAdmin()
  const code = String(formData.get('code') ?? '').trim().toUpperCase()
  const type: PromoType = String(formData.get('type') ?? 'PERCENT') === 'FIXED' ? 'FIXED' : 'PERCENT'
  const value = parseInt(String(formData.get('value') ?? '0'), 10)
  if (!code || !Number.isFinite(value) || value <= 0) return
  const expiresRaw = String(formData.get('expiresAt') ?? '')
  const maxRaw = String(formData.get('maxRedemptions') ?? '')
  try {
    await prisma.promoCode.create({
      data: {
        code,
        type,
        value,
        singleUse: formData.get('singleUse') === 'on',
        expiresAt: expiresRaw ? new Date(expiresRaw) : undefined,
        maxRedemptions: maxRaw ? parseInt(maxRaw, 10) : undefined,
      },
    })
  } catch {
    /* codice già esistente */
  }
  revalidatePath('/admin/promos')
}

async function togglePromo(formData: FormData) {
  'use server'
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const active = formData.get('active') === 'true'
  await prisma.promoCode.update({ where: { id }, data: { active: !active } }).catch(() => undefined)
  revalidatePath('/admin/promos')
}

async function deletePromo(formData: FormData) {
  'use server'
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  await prisma.promoCode.delete({ where: { id } }).catch(() => undefined)
  revalidatePath('/admin/promos')
}

export default async function AdminPromosPage() {
  const promos = await prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } })

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Codici promo</h1>

      <form action={createPromo} className="mt-5 grid grid-cols-2 gap-3 rounded-xl2 border border-line bg-surface p-5 sm:grid-cols-3">
        <input name="code" placeholder="CODICE" className="rounded-lg border border-line bg-bg px-3 py-2 text-sm uppercase outline-none focus:border-brand" />
        <select name="type" className="rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-brand">
          <option value="PERCENT">Percentuale</option>
          <option value="FIXED">Importo fisso (cent)</option>
        </select>
        <input name="value" type="number" min="1" placeholder="Valore" className="rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-brand" />
        <input name="expiresAt" type="date" className="rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink2 outline-none focus:border-brand" />
        <input name="maxRedemptions" type="number" min="1" placeholder="Max usi" className="rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-brand" />
        <label className="flex items-center gap-2 text-sm text-ink2">
          <input type="checkbox" name="singleUse" /> Uso singolo
        </label>
        <button className="bg-grad col-span-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white sm:col-span-3">Crea codice</button>
      </form>

      <div className="mt-5 overflow-hidden rounded-xl2 border border-line bg-surface">
        <div className="grid grid-cols-[1.4fr_1fr_0.8fr_1fr_1fr] gap-2 border-b border-line px-4 py-2.5 text-xs font-medium text-ink2">
          <span>Codice</span>
          <span>Sconto</span>
          <span>Usi</span>
          <span>Scadenza</span>
          <span>Azioni</span>
        </div>
        {promos.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink2">Nessun codice.</p>
        ) : (
          promos.map((pc) => (
            <div key={pc.id} className="grid grid-cols-[1.4fr_1fr_0.8fr_1fr_1fr] items-center gap-2 border-b border-line px-4 py-3 text-sm last:border-0">
              <span className="font-medium">{pc.code}</span>
              <span>{pc.type === 'PERCENT' ? `${pc.value}%` : `${(pc.value / 100).toFixed(2)} €`}</span>
              <span className="text-ink2">
                {pc.redeemedCount}
                {pc.maxRedemptions ? `/${pc.maxRedemptions}` : ''}
              </span>
              <span className="text-ink2">{pc.expiresAt ? fmt(pc.expiresAt) : '—'}</span>
              <span className="flex gap-2">
                <form action={togglePromo}>
                  <input type="hidden" name="id" value={pc.id} />
                  <input type="hidden" name="active" value={String(pc.active)} />
                  <button className="rounded-lg border border-line px-2.5 py-1 text-xs hover:bg-bg">
                    {pc.active ? 'Disattiva' : 'Attiva'}
                  </button>
                </form>
                <form action={deletePromo}>
                  <input type="hidden" name="id" value={pc.id} />
                  <button className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink2 hover:bg-bg">Elimina</button>
                </form>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
