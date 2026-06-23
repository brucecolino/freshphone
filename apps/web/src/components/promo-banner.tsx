import { getPromoBanner } from '@/lib/settings'

export async function PromoBanner() {
  const banner = await getPromoBanner()
  if (!banner.enabled || !banner.text) return null

  return (
    <div className="bg-grad px-4 py-2 text-center text-sm font-medium text-white">
      {banner.href ? (
        <a href={banner.href} className="underline-offset-2 hover:underline">
          {banner.text}
        </a>
      ) : (
        banner.text
      )}
    </div>
  )
}
