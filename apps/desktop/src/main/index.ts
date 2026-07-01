import { app, BrowserWindow, nativeTheme, nativeImage, ipcMain, shell, protocol, net } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readSettings, writeSettings, type ThemeSource } from './settings'
import { getState, listItems, browse, analyze, faces, pair, thumb, capabilities } from './device/manager'
import { agent } from './device/agent'
import { ensureOriginals } from './media/originals'
import { installAppleDrivers, driversPresent } from './drivers/onboarding'
import { exportSelection, planTransfer, type TransferUnit } from './transfer/export'
import { removeSelection } from './transfer/remove'
import { moveSelection } from './transfer/move'
import { openItem } from './media/open'
import { viewerDir, localMediaUrl } from './media/viewer'
import { getLog, openLogFile } from './log'
import { getAnalysisCache, mergeAnalysisCache, getFacesCache, mergeFacesCache } from './wizard'
import { getTags, saveTags, type TagsData } from './tags'
import { setupUpdater } from './updater'
import { getLicenseStatus, activate, deactivate, revalidate, getExportUsage, recordExports } from './license'
import type { SourceKey } from './device/engine'

// Protocollo per servire i file locali al visualizzatore interno (foto HEIC, video).
protocol.registerSchemesAsPrivileged([
  { scheme: 'fpmedia', privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true } },
])

let win: BrowserWindow | null = null

// ===== Deep link freshphone://activate?key=... + istanza singola =====
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const url = argv.find((a) => a.startsWith('freshphone://'))
    if (url) void handleDeepLink(url)
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
}
app.setAsDefaultProtocolClient('freshphone')

async function handleDeepLink(url: string): Promise<void> {
  try {
    const u = new URL(url)
    if (u.host === 'activate') {
      const key = u.searchParams.get('key')
      if (key) {
        await activate(key)
        win?.webContents.send('license:changed', getLicenseStatus())
      }
    }
  } catch {
    /* URL non valido */
  }
}

function resolvedTheme(): 'light' | 'dark' {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
}

function createWindow(): void {
  const settings = readSettings()
  nativeTheme.themeSource = settings.theme ?? 'system'

  win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 940,
    minHeight: 600,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0b1219' : '#f6f8fa',
    autoHideMenuBar: true,
    title: 'FreshPhone',
    icon: app.isPackaged ? undefined : join(app.getAppPath(), 'build', 'icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.on('ready-to-show', () => win?.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  protocol.handle('fpmedia', (req) => {
    try {
      const u = new URL(req.url)
      const name = decodeURIComponent(u.pathname.replace(/^\/+/, ''))
      if (!name || name.includes('..') || /[\\/]/.test(name)) return new Response('bad request', { status: 400 })
      return net.fetch(pathToFileURL(join(viewerDir(), name)).toString())
    } catch {
      return new Response('error', { status: 500 })
    }
  })
  ipcMain.handle('theme:get', () => ({ source: nativeTheme.themeSource, resolved: resolvedTheme() }))
  ipcMain.handle('theme:set', (_e, source: ThemeSource) => {
    nativeTheme.themeSource = source
    const s = readSettings()
    s.theme = source
    writeSettings(s)
    return { source, resolved: resolvedTheme() }
  })
  ipcMain.handle('settings:get', () => readSettings())
  ipcMain.handle('settings:set', (_e, patch: Record<string, unknown>) => {
    const s = { ...readSettings(), ...patch }
    writeSettings(s)
    return s
  })
  ipcMain.handle('device:status', () => getState())
  ipcMain.handle('device:list', (_e, source: SourceKey) => listItems(source))
  ipcMain.handle('device:browse', (_e, path: string) => browse(path))
  ipcMain.handle('device:analyze', (_e, ids: string[]) => analyze(ids))
  ipcMain.handle('wizard:cacheGet', () => getAnalysisCache())
  ipcMain.handle('wizard:cacheMerge', (_e, rows: { id: string; bright?: number; std?: number; hash?: string }[]) => mergeAnalysisCache(rows))
  ipcMain.handle('tags:get', () => getTags())
  ipcMain.handle('tags:set', (_e, data: TagsData) => saveTags(data))
  ipcMain.handle('device:faces', (_e, ids: string[]) => faces(ids))
  ipcMain.handle('faces:cacheGet', () => getFacesCache())
  ipcMain.handle('faces:cacheMerge', (_e, rows: { id: string; faces: { emb: string; score: number }[] }[]) => mergeFacesCache(rows))
  ipcMain.handle('device:pair', () => pair())
  ipcMain.handle('media:thumb', (_e, source: SourceKey, id: string, size?: number) => thumb(source, id, size))
  ipcMain.handle('media:open', (_e, source: SourceKey, id: string) => openItem(source, id))
  ipcMain.handle('media:localFile', (_e, source: SourceKey, id: string) => localMediaUrl(source, id))
  ipcMain.handle('media:capabilities', () => capabilities())
  ipcMain.handle('log:get', () => getLog())
  ipcMain.handle('log:open', () => openLogFile())
  ipcMain.handle('transfer:export', (e, source: SourceKey, items: TransferUnit[]) =>
    exportSelection(source, items, (p) => e.sender.send('transfer:progress', p)),
  )
  ipcMain.handle('transfer:remove', (e, source: SourceKey, ids: string[]) =>
    removeSelection(source, ids, (p) => e.sender.send('transfer:progress', p)),
  )
  ipcMain.handle('transfer:move', (e, source: SourceKey, items: TransferUnit[]) =>
    moveSelection(source, items, (p) => e.sender.send('transfer:progress', p)),
  )
  ipcMain.on('transfer:startDrag', async (e, source: SourceKey, items: TransferUnit[]) => {
    if (readSettings().demo) return
    // Anche il drag-and-drop rispetta il limite gratuito (coppie Live non spezzate) e conta.
    const plan = planTransfer(items)
    if (plan.files.length === 0) return
    const files = await ensureOriginals(source, plan.files)
    if (files.length === 0) return
    const icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    )
    e.sender.startDrag({ files, file: files[0], icon })
    recordExports(files.length)
  })
  ipcMain.handle('driver:status', () => ({ present: driversPresent() }))
  ipcMain.handle('driver:install', () => installAppleDrivers())
  ipcMain.handle('license:status', () => getLicenseStatus())
  ipcMain.handle('license:usage', () => getExportUsage())
  ipcMain.handle('license:activate', (_e, key: string) => activate(key))
  ipcMain.handle('license:deactivate', () => {
    deactivate()
    return getLicenseStatus()
  })

  nativeTheme.on('updated', () => {
    win?.webContents.send('theme:changed', { source: nativeTheme.themeSource, resolved: resolvedTheme() })
  })

  createWindow()
  setupUpdater(() => win)

  // Rivalidazione licenza (rinnovi/revoche degli abbonamenti) all'avvio e ogni 12h.
  const doRevalidate = (): void => {
    void revalidate()
      .then((st) => win?.webContents.send('license:changed', st))
      .catch(() => undefined)
  }
  setTimeout(doRevalidate, 5000)
  setInterval(doRevalidate, 12 * 60 * 60 * 1000)

  const initialUrl = process.argv.find((a) => a.startsWith('freshphone://'))
  if (initialUrl) void handleDeepLink(initialUrl)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => agent.stop())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
