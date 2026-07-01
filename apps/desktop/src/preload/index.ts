import { contextBridge, ipcRenderer } from 'electron'

type ThemeSource = 'system' | 'light' | 'dark'
interface ThemeState {
  source: ThemeSource
  resolved: 'light' | 'dark'
}

const api = {
  theme: {
    get: (): Promise<ThemeState> => ipcRenderer.invoke('theme:get'),
    set: (s: ThemeSource): Promise<ThemeState> => ipcRenderer.invoke('theme:set', s),
    onChanged: (cb: (s: ThemeState) => void): (() => void) => {
      const handler = (_e: unknown, s: ThemeState): void => cb(s)
      ipcRenderer.on('theme:changed', handler)
      return () => ipcRenderer.removeListener('theme:changed', handler)
    },
  },
  settings: {
    get: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('settings:get'),
    set: (patch: Record<string, unknown>): Promise<Record<string, unknown>> =>
      ipcRenderer.invoke('settings:set', patch),
  },
  device: {
    status: (): Promise<unknown> => ipcRenderer.invoke('device:status'),
    list: (source: string): Promise<unknown[]> => ipcRenderer.invoke('device:list', source),
    browse: (path: string): Promise<unknown[]> => ipcRenderer.invoke('device:browse', path),
    analyze: (ids: string[]): Promise<{ id: string; bright?: number; std?: number; hash?: string }[]> =>
      ipcRenderer.invoke('device:analyze', ids),
    faces: (ids: string[]): Promise<{ id: string; faces: { emb: string; score: number }[] }[]> =>
      ipcRenderer.invoke('device:faces', ids),
    pair: (): Promise<{ ok: boolean; message: string }> => ipcRenderer.invoke('device:pair'),
  },
  media: {
    thumb: (source: string, id: string, size?: number): Promise<string | null> =>
      ipcRenderer.invoke('media:thumb', source, id, size),
    open: (source: string, id: string): Promise<{ ok: boolean; message?: string }> =>
      ipcRenderer.invoke('media:open', source, id),
    localFile: (source: string, id: string): Promise<{ ok: boolean; url?: string; message?: string }> =>
      ipcRenderer.invoke('media:localFile', source, id),
    capabilities: (): Promise<{ afc: boolean; ffmpeg: boolean }> => ipcRenderer.invoke('media:capabilities'),
  },
  driver: {
    status: (): Promise<{ present: boolean }> => ipcRenderer.invoke('driver:status'),
    install: (): Promise<{ ok: boolean; message: string }> => ipcRenderer.invoke('driver:install'),
  },
  log: {
    get: (): Promise<string> => ipcRenderer.invoke('log:get'),
    open: (): Promise<void> => ipcRenderer.invoke('log:open'),
  },
  wizard: {
    cacheGet: (): Promise<Record<string, { bright?: number; std?: number; hash?: string }>> => ipcRenderer.invoke('wizard:cacheGet'),
    cacheMerge: (rows: { id: string; bright?: number; std?: number; hash?: string }[]): Promise<void> =>
      ipcRenderer.invoke('wizard:cacheMerge', rows),
  },
  tags: {
    get: (): Promise<{ tags: { id: string; label: string; color: string }[]; assign: Record<string, string[]> }> =>
      ipcRenderer.invoke('tags:get'),
    set: (data: { tags: { id: string; label: string; color: string }[]; assign: Record<string, string[]> }): Promise<void> =>
      ipcRenderer.invoke('tags:set', data),
  },
  faces: {
    cacheGet: (): Promise<Record<string, { emb: string; score: number }[]>> => ipcRenderer.invoke('faces:cacheGet'),
    cacheMerge: (rows: { id: string; faces: { emb: string; score: number }[] }[]): Promise<void> =>
      ipcRenderer.invoke('faces:cacheMerge', rows),
  },
  updates: {
    version: (): Promise<string> => ipcRenderer.invoke('updates:version'),
    check: (): Promise<{ ok: boolean; dev?: boolean; message?: string }> => ipcRenderer.invoke('update:check'),
    download: (): Promise<{ ok: boolean; message?: string }> => ipcRenderer.invoke('update:download'),
    install: (): Promise<void> => ipcRenderer.invoke('update:install'),
    onEvent: (cb: (e: { type: string; version?: string; notes?: string; percent?: number; message?: string }) => void): (() => void) => {
      const channels = ['update:available', 'update:none', 'update:progress', 'update:downloaded', 'update:error']
      const subs = channels.map((ch) => {
        const handler = (_e: unknown, payload: Record<string, unknown>): void => cb({ type: ch.split(':')[1], ...(payload ?? {}) })
        ipcRenderer.on(ch, handler)
        return { ch, handler }
      })
      return () => subs.forEach(({ ch, handler }) => ipcRenderer.removeListener(ch, handler))
    },
  },
  transfer: {
    export: (
      source: string,
      items: { id: string; mov?: string }[],
    ): Promise<{ ok: boolean; copied?: number; total?: number; dir?: string; demo?: boolean; message?: string }> =>
      ipcRenderer.invoke('transfer:export', source, items),
    remove: (
      source: string,
      ids: string[],
    ): Promise<{ ok: boolean; deleted?: number; total?: number; demo?: boolean; message?: string }> =>
      ipcRenderer.invoke('transfer:remove', source, ids),
    startDrag: (source: string, items: { id: string; mov?: string }[]): void =>
      ipcRenderer.send('transfer:startDrag', source, items),
    onProgress: (cb: (p: { op: string; index: number; total: number; file: string }) => void): (() => void) => {
      const handler = (_e: unknown, p: { op: string; index: number; total: number; file: string }): void => cb(p)
      ipcRenderer.on('transfer:progress', handler)
      return () => ipcRenderer.removeListener('transfer:progress', handler)
    },
    move: (
      source: string,
      items: { id: string; mov?: string }[],
    ): Promise<{ ok: boolean; moved?: number; total?: number; dir?: string; demo?: boolean; message?: string }> =>
      ipcRenderer.invoke('transfer:move', source, items),
  },
  license: {
    status: (): Promise<{ state: string; key?: string; plan?: string; expiresAt?: string | null }> =>
      ipcRenderer.invoke('license:status'),
    usage: (): Promise<{ licensed: boolean; limit: number | null; used: number; remaining: number | null }> =>
      ipcRenderer.invoke('license:usage'),
    activate: (key: string): Promise<{ ok: boolean; message: string }> => ipcRenderer.invoke('license:activate', key),
    deactivate: (): Promise<{ state: string }> => ipcRenderer.invoke('license:deactivate'),
    onChanged: (cb: (s: { state: string; plan?: string; expiresAt?: string | null }) => void): (() => void) => {
      const handler = (_e: unknown, s: { state: string; plan?: string; expiresAt?: string | null }): void => cb(s)
      ipcRenderer.on('license:changed', handler)
      return () => ipcRenderer.removeListener('license:changed', handler)
    },
  },
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('fp', api)
} else {
  ;(globalThis as unknown as { fp: typeof api }).fp = api
}

export type FpApi = typeof api
