import { app, shell } from 'electron'
import { join } from 'node:path'
import { appendFile } from 'node:fs/promises'

// Log centralizzato: dettagli tecnici qui (NON nella GUI). Buffer in memoria + file.
const LINES: string[] = []
const MAX = 3000
let cachedPath = ''

function logPath(): string {
  if (!cachedPath) cachedPath = join(app.getPath('userData'), 'freshphone.log')
  return cachedPath
}

export function logLine(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}`
  LINES.push(line)
  if (LINES.length > MAX) LINES.shift()
  appendFile(logPath(), line + '\n').catch(() => undefined)
}

export function getLog(): string {
  return LINES.length ? LINES.join('\n') : 'Nessun evento registrato finora.'
}

export function openLogFile(): void {
  void shell.openPath(logPath())
}
