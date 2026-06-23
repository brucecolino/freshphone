import { LogoMark } from './logo'
import { cn } from '@/lib/cn'

const tiles = [
  '#86C9B0', '#8FBFD6', '#7FB7C9', '#E6B980', '#E0A38F', '#B3A6E0', '#AEB9C2', '#9BCF8E', '#8FB0D6', '#A0CBB4', '#C9B27F', '#7FC9B8',
]

export function AppPreview() {
  return (
    <div className="overflow-hidden rounded-xl2 border border-line bg-surface shadow-lg">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <LogoMark size={20} />
        <span className="text-grad font-display text-sm font-bold">FreshPhone</span>
        <div className="ml-auto flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
        </div>
      </div>
      <div className="flex">
        <div className="hidden w-28 shrink-0 flex-col gap-1 border-r border-line p-2 sm:flex">
          {['Home', 'Foto e video', 'File', 'Spazio'].map((x, i) => (
            <div
              key={x}
              className={cn('rounded-md px-2 py-1.5 text-xs', i === 1 ? 'bg-grad-soft font-medium text-ink' : 'text-ink2')}
            >
              {x}
            </div>
          ))}
        </div>
        <div className="flex-1 p-3">
          <div className="grid grid-cols-4 gap-2">
            {tiles.map((c, i) => (
              <div
                key={i}
                className={cn('relative aspect-square rounded-md', (i === 3 || i === 7 || i === 11) && 'ring-2 ring-brand ring-offset-2 ring-offset-surface')}
                style={{ background: c }}
              >
                {(i === 2 || i === 6) && (
                  <span className="absolute bottom-1 right-1 rounded bg-black/55 px-1 text-[10px] text-white">0:14</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-line px-3 py-2.5">
        <span className="text-xs text-ink2">Spazio iPhone</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
          <div className="bg-grad h-full" style={{ width: '70%' }} />
        </div>
        <span className="text-xs font-medium text-ink">38,8 GB liberi</span>
      </div>
    </div>
  )
}
