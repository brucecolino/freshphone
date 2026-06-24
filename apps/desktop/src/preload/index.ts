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
  transfer: {
    export: (
      source: string,
      ids: string[],
    ): Promise<{ ok: boolean; copied?: number; total?: number; dir?: string; demo?: boolean; message?: string }> =>
      ipcRenderer.invoke('transfer:export', source, ids),
    remove: (
      source: string,
      ids: string[],
    ): Promise<{ ok: boolean; deleted?: number; total?: number; demo?: boolean; message?: string }> =>
      ipcRenderer.invoke('transfer:remove', source, ids),
    startDrag: (source: string, ids: string[]): void => ipcRenderer.send('transfer:startDrag', source, ids),
    move: (
      source: string,
      ids: string[],
    ): Promise<{ ok: boolean; moved?: number; total?: number; dir?: string; demo?: boolean; message?: string }> =>
      ipcRenderer.invoke('transfer:move', source, ids),
  },
  license: {
    status: (): Promise<{ state: string; key?: string; plan?: string; expiresAt?: string | null }> =>
      ipcRenderer.invoke('license:status'),
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
