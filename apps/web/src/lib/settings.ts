import { unstable_cache } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export interface PromoBanner {
  enabled: boolean
  text: string
  href?: string
}

const DEFAULT_BANNER: PromoBanner = { enabled: false, text: '' }

async function readBanner(): Promise<PromoBanner> {
  // Senza DB (es. build) restituisci il default: niente query.
  if (!process.env.DATABASE_URL) return DEFAULT_BANNER
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: 'promoBanner' } })
    if (!row) return DEFAULT_BANNER
    return { ...DEFAULT_BANNER, ...(row.value as unknown as Partial<PromoBanner>) }
  } catch {
    return DEFAULT_BANNER
  }
}

// Cache con tag, così le pagine restano veloci; si invalida quando l'admin salva.
export const getPromoBanner = unstable_cache(readBanner, ['promo-banner'], {
  tags: ['site-settings'],
  revalidate: 60,
})

export async function setPromoBanner(value: PromoBanner): Promise<void> {
  const json = value as unknown as Prisma.InputJsonValue
  await prisma.siteSetting.upsert({
    where: { key: 'promoBanner' },
    update: { value: json },
    create: { key: 'promoBanner', value: json },
  })
}
