import { cookies } from 'next/headers'
import { dictionaries, type Locale } from './dictionaries'

export async function getLocale(): Promise<Locale> {
  const c = await cookies()
  return c.get('locale')?.value === 'en' ? 'en' : 'it'
}

export async function getDict() {
  const locale = await getLocale()
  return { locale, t: dictionaries[locale] }
}
