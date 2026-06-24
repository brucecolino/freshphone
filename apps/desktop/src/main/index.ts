import { app, BrowserWindow, nativeTheme, nativeImage, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { readSettings, writeSettings, type ThemeSource } from './settings'
import { getState, listItems, pair, thumb, capabilities } from './device/manager'
import { probe } from './device/libimobiledevice'
import { ensureOriginals } from './media/originals'
import { installAppleDrivers } from './drivers/onboarding'
import { exportSelection } from './transfer/export'
import { removeSelection } from './transfer/remove'
import { getLicenseStatus, activate, deactivate } from './license'
import type { SourceKey } from './device/engine'

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
  ipcMain.handle('device:pair', () => pair())
  ipcMain.handle('media:thumb', (_e, source: SourceKey, id: string) => thumb(source, id))
  ipcMain.handle('media:capabilities', () => capabilities())
  ipcMain.handle('transfer:export', (_e, source: SourceKey, ids: string[]) => exportSelection(source, ids))
  ipcMain.handle('transfer:remove', (_e, source: SourceKey, ids: string[]) => removeSelection(source, ids))
  ipcMain.on('transfer:startDrag', async (e, source: SourceKey, ids: string[]) => {
    if (readSettings().demo) return
    const p = await probe()
    if (!p.connected || !p.trusted || !p.udid) return
    const files = await ensureOriginals(p.udid, source, ids)
    if (files.length === 0) return
    const icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    )
    e.sender.startDrag({ files, file: files[0], icon })
  })
  ipcMain.handle('driver:install', () => installAppleDrivers())
  ipcMain.handle('license:status', () => getLicenseStatus())
  ipcMain.handle('license:activate', (_e, key: string) => activate(key))
  ipcMain.handle('license:deactivate', () => {
    deactivate()
    return getLicenseStatus()
  })

  nativeTheme.on('updated', () => {
    win?.webContents.send('theme:changed', { source: nativeTheme.themeSource, resolved: resolvedTheme() })
  })

  createWindow()
  const initialUrl = process.argv.find((a) => a.startsWith('freshphone://'))
  if (initialUrl) void handleDeepLink(initialUrl)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
