import { app, BrowserWindow, nativeTheme, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { readSettings, writeSettings, type ThemeSource } from './settings'
import { getState, listItems, pair, thumb } from './device/manager'
import { installAppleDrivers } from './drivers/onboarding'
import type { SourceKey } from './device/engine'

let win: BrowserWindow | null = null

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
  ipcMain.handle('driver:install', () => installAppleDrivers())

  nativeTheme.on('updated', () => {
    win?.webContents.send('theme:changed', { source: nativeTheme.themeSource, resolved: resolvedTheme() })
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
