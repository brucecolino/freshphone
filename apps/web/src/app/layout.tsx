import type { Metadata } from 'next'
import { Poppins, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'
import { PromoBanner } from '@/components/promo-banner'

const display = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
})

const body = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'FreshPhone — Gestore file iPhone per Windows',
  description:
    'Libera spazio sul tuo iPhone senza iTunes. Visualizza, ordina e sposta foto, video e file sul PC conservando tutti i metadati, poi cancella in sicurezza.',
  keywords: ['iPhone', 'gestione file', 'Windows', 'iTunes alternativa', 'trasferimento foto', 'liberare spazio'],
  openGraph: {
    title: 'FreshPhone — Gestore file iPhone per Windows',
    description: 'Organizza il tuo iPhone e fai spazio, senza iTunes.',
    type: 'website',
    images: ['/freshphone-logo.png'],
  },
}

const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${display.variable} ${body.variable} font-sans antialiased`}>
        <PromoBanner />
        <SiteNav />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  )
}
