import { app, ipcMain, type BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'
import { logLine } from './log'

const { autoUpdater } = electronUpdater

// Note di rilascio: electron-updater le passa come stringa o array {version, note}.
function notesToText(notes: string | Array<{ version: string; note: string | null }> | null | undefined): string {
  if (!notes) return ''
  if (typeof notes === 'string') return notes.replace(/<[^>]+>/g, '').trim()
  return notes.map((n) => n.note ?? '').join('\n').replace(/<[^>]+>/g, '').trim()
}

// Aggiornamento automatico via GitHub Releases. L'utente controlla: prima avvisiamo
// (update:available), poi scarica su richiesta (barra di avanzamento), poi installa.
export function setupUpdater(getWin: () => BrowserWindow | null): void {
  const send = (channel: string, payload?: unknown): void => getWin()?.webContents.send(channel, payload)

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    logLine('update: disponibile ' + info.version)
    send('update:available', { version: info.version, notes: notesToText(info.releaseNotes) })
  })
  autoUpdater.on('update-not-available', () => send('update:none'))
  autoUpdater.on('download-progress', (p) => send('update:progress', { percent: p.percent, transferred: p.transferred, total: p.total, bytesPerSecond: p.bytesPerSecond }))
  autoUpdater.on('update-downloaded', (info) => {
    logLine('update: scaricato ' + info.version)
    send('update:downloaded', { version: info.version })
  })
  autoUpdater.on('error', (err) => {
    logLine('update: errore ' + String((err as Error)?.message || err))
    send('update:error', { message: String((err as Error)?.message || err) })
  })

  ipcMain.handle('update:check', async () => {
    if (!app.isPackaged) return { ok: false, dev: true } // in dev non c'è canale aggiornamenti
    try {
      await autoUpdater.checkForUpdates()
      return { ok: true }
    } catch (e) {
      return { ok: false, message: String((e as Error)?.message || e) }
    }
  })
  ipcMain.handle('update:download', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { ok: true }
    } catch (e) {
      return { ok: false, message: String((e as Error)?.message || e) }
    }
  })
  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall()
  })
  ipcMain.handle('updates:version', () => app.getVersion())

  // Controllo automatico all'avvio (solo in produzione).
  if (app.isPackaged) {
    setTimeout(() => void autoUpdater.checkForUpdates().catch(() => undefined), 4000)
  }
}
