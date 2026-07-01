import { revalidatePath } from 'next/cache'
import type { Plan } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin'
import { issueLicense } from '@/lib/licensing'
import type { PlanId } from '@freshphone/shared'

export const dynamic = 'force-dynamic'

const fmt = (d: Date) => new Intl.DateTimeFormat('it-IT', { dateStyle: 'short' }).format(d)
const PLAN_LABEL: Record<Plan, string> = { FREE: 'Free', MONTHLY: 'Mensile', SIXMONTH: 'Semestrale', YEARLY: 'Annuale', LIFETIME: 'A vita' }

async function createLicense(formData: FormData) {
  'use server'
  await requireAdmin()
  const plan = String(formData.get('plan') ?? 'lifetime') as PlanId
  const seats = Math.max(1, Math.min(50, parseInt(String(formData.get('seatLimit') ?? '1'), 10) || 1))
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  let userId: string | undefined
  if (email) userId = (await prisma.user.findUnique({ where: { email } }))?.id
  const lic = await issueLicense({ plan, userId })
  if (seats !== 1) await prisma.license.update({ where: { id: lic.id }, data: { seatLimit: seats } })
  revalidatePath('/admin/licenses')
}

async function toggleRevoke(formData: FormData) {
  'use server'
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const status = String(formData.get('status') ?? '')
  await prisma.license.update({ where: { id }, data: { status: status === 'REVOKED' ? 'ACTIVE' : 'REVOKED' } }).catch(() => undefined)
  revalidatePath('/admin/licenses')
}

export default async function AdminLicensesPage() {
  const licenses = await prisma.license.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { _count: { select: { activations: true } }, user: { select: { email: true } } },
  })

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold">Licenze</h1>
      <p className="mt-1 text-sm text-ink2">
        Crea licenze manuali (es. una “a vita” per te o per i tester). La chiave generata appare in cima alla tabella, pronta da attivare nell’app.
      </p>

      <form action={createLicense} className="mt-5 grid grid-cols-2 gap-3 rounded-xl2 border border-line bg-surface p-5 sm:grid-cols-4">
        <select name="plan" defaultValue="lifetime" className="rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-brand">
          <option value="lifetime">A vita</option>
          <option value="yearly">Annuale</option>
          <option value="sixmonth">Semestrale</option>
          <option value="monthly">Mensile</option>
        </select>
        <input name="seatLimit" type="number" min="1" max="50" defaultValue="1" title="Numero di postazioni" className="rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-brand" />
        <input name="email" type="email" placeholder="Email utente (opzionale)" className="col-span-2 rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-brand sm:col-span-1" />
        <button className="bg-grad col-span-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white sm:col-span-1">Crea licenza</button>
      </form>

      <div className="mt-5 overflow-hidden rounded-xl2 border border-line bg-surface">
        <div className="grid grid-cols-[1.9fr_0.8fr_0.8fr_0.9fr_0.6fr_0.8fr] gap-2 border-b border-line px-4 py-2.5 text-xs font-medium text-ink2">
          <span>Chiave</span>
          <span>Piano</span>
          <span>Stato</span>
          <span>Scadenza</span>
          <span>Posti</span>
          <span>Azioni</span>
        </div>
        {licenses.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink2">Nessuna licenza.</p>
        ) : (
          licenses.map((l) => (
            <div key={l.id} className="grid grid-cols-[1.9fr_0.8fr_0.8fr_0.9fr_0.6fr_0.8fr] items-center gap-2 border-b border-line px-4 py-3 text-sm last:border-0">
              <span className="select-all font-mono text-xs">{l.key}</span>
              <span>{PLAN_LABEL[l.plan]}</span>
              <span className={l.status === 'ACTIVE' ? 'font-medium text-green-600' : 'text-ink2'}>{l.status}</span>
              <span className="text-ink2">{l.expiresAt ? fmt(l.expiresAt) : 'A vita'}</span>
              <span className="text-ink2">
                {l._count.activations}/{l.seatLimit}
              </span>
              <span>
                <form action={toggleRevoke}>
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="status" value={l.status} />
                  <button className="rounded-lg border border-line px-2.5 py-1 text-xs hover:bg-bg">{l.status === 'REVOKED' ? 'Riattiva' : 'Revoca'}</button>
                </form>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
