import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REPO = 'brucecolino/freshphone'
const RELEASES = `https://github.com/${REPO}/releases/latest`

// Avvia il download dell'installer giusto in base all'OS, senza mandare l'utente
// su GitHub: interroga l'ultima release, trova l'asset (.exe per Windows, .dmg per
// Mac) e reindirizza (302) direttamente al file. Fallback: pagina releases.
export async function GET(req: Request) {
  const os = new URL(req.url).searchParams.get('os') === 'mac' ? 'mac' : 'win'
  const ext = os === 'mac' ? '.dmg' : '.exe'
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'freshphone-site' },
      // Cache breve: dopo una nuova release il download punta alla versione giusta
      // entro ~1 min (evita di servire l'installer vecchio), restando sotto i limiti API.
      next: { revalidate: 60 },
    })
    if (!res.ok) return NextResponse.redirect(RELEASES, 302)
    const rel = (await res.json()) as { assets?: { name?: string; browser_download_url?: string }[] }
    const asset = (rel.assets ?? []).find((a) => a.name?.toLowerCase().endsWith(ext))
    if (!asset?.browser_download_url) return NextResponse.redirect(RELEASES, 302)
    return NextResponse.redirect(asset.browser_download_url, 302)
  } catch {
    return NextResponse.redirect(RELEASES, 302)
  }
}
