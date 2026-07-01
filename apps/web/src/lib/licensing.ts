import type { Plan as PrismaPlan, LicenseStatus, SubscriptionStatus } from '@prisma/client'
import { generateLicenseKey, signActivationToken, computeExpiry, type PlanId } from '@freshphone/shared'
import { prisma } from '@/lib/db'

// Mapping tra enum Prisma (MAIUSCOLO) e PlanId condiviso (minuscolo).
export function prismaPlanToShared(p: PrismaPlan): PlanId {
  return p.toLowerCase() as PlanId
}

export function sharedPlanToPrisma(p: PlanId): PrismaPlan {
  return p.toUpperCase() as PrismaPlan
}

function privateKeyPem(): string {
  const raw = process.env.LICENSE_PRIVATE_KEY
  if (!raw) throw new Error('LICENSE_PRIVATE_KEY non configurata')
  return raw.replace(/\\n/g, '\n')
}

/** Crea e salva una nuova licenza per un piano (con scadenza in base al piano). */
export async function issueLicense(params: {
  plan: PlanId
  userId?: string | null
  orderId?: string | null
}) {
  const expiresAt = computeExpiry(params.plan)

  let key = generateLicenseKey()
  for (let i = 0; i < 5; i++) {
    const existing = await prisma.license.findUnique({ where: { key } })
    if (!existing) break
    key = generateLicenseKey()
  }

  return prisma.license.create({
    data: {
      key,
      plan: sharedPlanToPrisma(params.plan),
      userId: params.userId ?? undefined,
      orderId: params.orderId ?? undefined,
      expiresAt: expiresAt ?? undefined,
    },
  })
}

/** Firma un token di attivazione (verificabile offline dall'app desktop). */
export async function mintActivationToken(licenseKey: string, machineId?: string): Promise<string> {
  const lic = await prisma.license.findUnique({ where: { key: licenseKey } })
  if (!lic) throw new Error('Licenza non trovata')
  if (lic.status !== 'ACTIVE') throw new Error('Licenza non attiva')
  return signActivationToken(
    privateKeyPem(),
    { key: lic.key, plan: prismaPlanToShared(lic.plan), mid: machineId },
    lic.expiresAt ?? null,
  )
}

// Giorni di tolleranza dopo la fine del periodo pagato prima che la licenza scada.
const GRACE_DAYS = 3

function periodEndToExpiry(currentPeriodEnd: number | null): Date | null {
  if (!currentPeriodEnd) return null
  return new Date(currentPeriodEnd * 1000 + GRACE_DAYS * 24 * 60 * 60 * 1000)
}

/**
 * Allinea lo stato di una licenza in abbonamento a quanto riportato da Stripe.
 *  - pagamento ok / rinnovo           -> ACTIVE, expiresAt = fine periodo (+grace)
 *  - pagamento fallito (retry Stripe) -> PAST_DUE (licenza valida finché non passa expiresAt)
 *  - abbonamento annullato / insoluto -> EXPIRED
 * È così che "dopo tot tempo" un abbonamento non pagato smette di funzionare: l'app
 * valida offline la scadenza e il server rifiuta la ri-attivazione di una licenza scaduta.
 */
export async function syncSubscriptionState(params: {
  subscriptionId: string
  stripeStatus: string
  currentPeriodEnd?: number | null
}): Promise<void> {
  const order = await prisma.order.findFirst({
    where: { providerSubscriptionId: params.subscriptionId },
    include: { license: true },
  })
  const lic = order?.license
  if (!lic) return

  let status: LicenseStatus = lic.status
  let subscriptionStatus: SubscriptionStatus = lic.subscriptionStatus
  let expiresAt: Date | null = lic.expiresAt
  const paidPeriodEnd = periodEndToExpiry(params.currentPeriodEnd ?? null)
  const now = new Date()

  switch (params.stripeStatus) {
    case 'active':
    case 'trialing':
      status = 'ACTIVE'
      subscriptionStatus = 'ACTIVE'
      // Solo un periodo effettivamente PAGATO estende la scadenza, e solo in avanti:
      // così un webhook fuori ordine con un period_end vecchio non accorcia la licenza.
      if (paidPeriodEnd && (!expiresAt || paidPeriodEnd > expiresAt)) expiresAt = paidPeriodEnd
      break
    case 'past_due':
      // Rinnovo non riuscito: Stripe ha già avanzato il periodo ma NON è pagato.
      // Non estendere expiresAt: la licenza resta valida solo fino al periodo già pagato.
      subscriptionStatus = 'PAST_DUE'
      break
    case 'canceled':
      // Onora il periodo già pagato: resta valida fino a expiresAt (poi cron/attivazione
      // la scadono). Se non c'è più periodo pagato, scade subito.
      subscriptionStatus = 'CANCELED'
      if (!expiresAt || expiresAt <= now) status = 'EXPIRED'
      break
    case 'unpaid':
    case 'incomplete_expired':
      // Insoluto dopo i tentativi / pagamento iniziale mai completato: revoca subito.
      status = 'EXPIRED'
      subscriptionStatus = 'EXPIRED'
      break
    default:
      break
  }

  await prisma.license.update({
    where: { id: lic.id },
    data: { status, subscriptionStatus, expiresAt },
  })
}
