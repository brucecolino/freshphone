import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin'
import { sendMail, newsletterCampaignHtml } from '@/lib/mail'

export const dynamic = 'force-dynamic'

const fmt = (d: Date) => new Intl.DateTimeFormat('it-IT', { dateStyle: 'short' }).format(d)
const statusLabel: Record<string, string> = { CONFIRMED: 'Confermato', PENDING: 'In attesa', UNSUBSCRIBED: 'Disiscritto' }

async function sendCampaign(formData: FormData) {
  'use server'
  const admin = await requireAdmin()
  const subject = String(formData.get('subject') ?? '').trim()
  const message = String(formData.get('message') ?? '').trim()
  const promoCode = String(formData.get('promoCode') ?? '').trim().toUpperCase() || undefined
  if (!subject || !message) return

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const subs = await prisma.newsletterSubscriber.findMany({ where: { status: 'CONFIRMED' } })

  for (const s of subs) {
    await sendMail({
      to: s.email,
      subject,
      html: newsletterCampaignHtml({ message, promoCode, unsubUrl: `${site}/newsletter/unsubscribe?token=${s.unsubToken}` }),
    })
  }

  await prisma.auditLog.create({
    data: {
      actorEmail: admin.email ?? 'admin',
      action: 'newsletter.campaign',
      details: { subject, count: subs.length, promoCode: promoCode ?? null },
    },
  })
  revalidatePath('/admin/newsletter')
}

export default async function AdminNewsletterPage() {
  const [confirmed, pending, recent] = await Promise.all([
    prisma.newsletterSubscriber.count({ where: { status: 'CONFIRMED' } }),
    prisma.newsletterSubscriber.count({ where: { status: 'PENDING' } }),
    prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
  ])

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Newsletter</h1>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl2 border border-line bg-surface p-5">
          <p className="text-xs text-ink2">Confermati</p>
          <p className="mt-1 font-display text-2xl font-bold">{confirmed}</p>
        </div>
        <div className="rounded-xl2 border border-line bg-surface p-5">
          <p className="text-xs text-ink2">In attesa</p>
          <p className="mt-1 font-display text-2xl font-bold">{pending}</p>
        </div>
      </div>

      <form action={sendCampaign} className="mt-6 space-y-3 rounded-xl2 border border-line bg-surface p-5">
        <h2 className="font-display font-semibold">Invia campagna</h2>
        <input
          name="subject"
          placeholder="Oggetto"
          className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <textarea
          name="message"
          rows={5}
          placeholder="Messaggio…"
          className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <input
          name="promoCode"
          placeholder="Codice promo (opzionale)"
          className="w-full max-w-xs rounded-lg border border-line bg-bg px-3 py-2 text-sm uppercase outline-none focus:border-brand"
        />
        <button className="bg-grad rounded-full px-5 py-2.5 text-sm font-semibold text-white">
          Invia a {confirmed} iscritti
        </button>
        <p className="text-xs text-ink2">L’invio viene registrato nell’audit log. Senza provider email configurato, gli invii vengono solo loggati.</p>
      </form>

      <div className="mt-6 overflow-hidden rounded-xl2 border border-line bg-surface">
        <div className="grid grid-cols-[2fr_1fr_1fr] gap-2 border-b border-line px-4 py-2.5 text-xs font-medium text-ink2">
          <span>Email</span>
          <span>Stato</span>
          <span>Data</span>
        </div>
        {recent.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink2">Nessun iscritto.</p>
        ) : (
          recent.map((s) => (
            <div key={s.id} className="grid grid-cols-[2fr_1fr_1fr] gap-2 border-b border-line px-4 py-3 text-sm last:border-0">
              <span className="truncate">{s.email}</span>
              <span className="text-ink2">{statusLabel[s.status] ?? s.status}</span>
              <span className="text-ink2">{fmt(s.createdAt)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
