import { spawn } from 'node:child_process'

// Installer driver Apple di NelloKudo (scarica gli .inf dal Microsoft Update Catalog).
// Richiede elevazione: lo avviamo via Start-Process -Verb RunAs (prompt UAC).
const INSTALLER_URL =
  'https://raw.githubusercontent.com/NelloKudo/Apple-Mobile-Drivers-Installer/main/AppleDrivInstaller.ps1'

export function installAppleDrivers(): { ok: boolean; message: string } {
  if (process.platform !== 'win32') return { ok: false, message: 'Disponibile solo su Windows' }

  const inner = `iex (Invoke-RestMethod -Uri '${INSTALLER_URL}')`
  const elevate = `Start-Process powershell -Verb RunAs -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-Command', ${JSON.stringify(
    inner,
  )})`

  try {
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', elevate], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    })
    child.unref()
    return { ok: true, message: 'Avvio dell’installer driver: conferma il prompt di Windows (UAC).' }
  } catch (e) {
    return { ok: false, message: `Impossibile avviare l’installer: ${String(e)}` }
  }
}
