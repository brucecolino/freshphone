import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

// Rete di sicurezza: se un webhook di Stripe viene perso, questo cron (giornaliero,
// vedi vercel.json) scade comunque le licenze il cui periodo pagato è terminato.
// Protetto da CRON_SECRET (Vercel Cron invia "Authorization: Bearer <CRON_SECRET>").
export async function GET(req: Request): Promise<NextResponse> {
  // Fail-closed: senza CRON_SECRET l'endpoint non è utilizzabile (niente updateMany pubblico).
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'cron non configurato' }, { status: 503 })
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'non autorizzato' }, { status: 401 })
  }

  const now = new Date()
  const res = await prisma.license.updateMany({
    where: { status: 'ACTIVE', expiresAt: { not: null, lt: now } },
    data: { status: 'EXPIRED' },
  })
  return NextResponse.json({ expired: res.count, at: now.toISOString() })
}
