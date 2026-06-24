import logoUrl from '../assets/logo.png'

export function LogoMark({ size = 26 }: { size?: number }) {
  return <img src={logoUrl} width={size} height={size} alt="" className="block shrink-0" />
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={28} />
      <span className="text-grad font-display text-base font-bold tracking-tight">FreshPhone</span>
    </span>
  )
}
