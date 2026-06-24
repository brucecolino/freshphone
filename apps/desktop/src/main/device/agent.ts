import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { app } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

// Client del processo helper Python persistente (resources/agent/fp_agent.py).
// Una sola sessione pymobiledevice3 viva: niente avvio di Python per chiamata
// (veloce) e nessuna sessione lockdown concorrente (trust stabile).

function resourcesDir(): string {
  return app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources')
}

// Avvio: exe freezato (prod) oppure Python 3.11 + script (dev). Override: FRESHPHONE_AGENT.
function agentCommand(): { cmd: string; args: string[] } | null {
  const script = join(resourcesDir(), 'agent', 'fp_agent.py')
  const override = process.env.FRESHPHONE_AGENT
  if (override) return { cmd: override, args: existsSync(script) ? [script] : [] }
  const exe = join(resourcesDir(), 'bin', process.platform === 'win32' ? 'fp_agent.exe' : 'fp_agent')
  if (existsSync(exe)) return { cmd: exe, args: [] }
  if (!existsSync(script)) return null
  if (process.platform === 'win32') return { cmd: 'py', args: ['-3.11', script] }
  return { cmd: 'python3', args: [script] }
}

interface Pending {
  resolve: (v: unknown) => void
  reject: (e: Error) => void
  timer: ReturnType<typeof setTimeout>
}

class DeviceAgent {
  private proc: ChildProcessWithoutNullStreams | null = null
  private buf = ''
  private seq = 0
  private pending = new Map<number, Pending>()
  private unavailable = false

  private ensure(): boolean {
    if (this.proc && this.proc.exitCode === null && !this.proc.killed) return true
    if (this.unavailable) return false
    const c = agentCommand()
    if (!c) {
      this.unavailable = true
      return false
    }
    try {
      const p = spawn(c.cmd, c.args, { windowsHide: true }) as ChildProcessWithoutNullStreams
      p.stdout.setEncoding('utf8')
      p.stdout.on('data', (d: string) => this.onData(d))
      p.stderr.on('data', () => {
        /* log/avvisi di pymobiledevice3: ignorati */
      })
      p.on('exit', () => this.cleanup())
      p.on('error', () => {
        this.cleanup()
        this.unavailable = true // comando non trovato (es. Python assente)
      })
      this.proc = p
      return true
    } catch {
      this.proc = null
      this.unavailable = true
      return false
    }
  }

  private cleanup(): void {
    for (const [, pend] of this.pending) {
      clearTimeout(pend.timer)
      pend.reject(new Error('agent terminato'))
    }
    this.pending.clear()
    this.proc = null
    this.buf = ''
  }

  private onData(chunk: string): void {
    this.buf += chunk
    let idx: number
    while ((idx = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, idx).trim()
      this.buf = this.buf.slice(idx + 1)
      if (!line) continue
      let msg: { id?: number; ok?: boolean; result?: unknown; error?: string }
      try {
        msg = JSON.parse(line)
      } catch {
        continue
      }
      if (msg.id == null) continue
      const pend = this.pending.get(msg.id)
      if (!pend) continue
      this.pending.delete(msg.id)
      clearTimeout(pend.timer)
      if (msg.ok) pend.resolve(msg.result)
      else pend.reject(new Error(msg.error || 'errore agent'))
    }
  }

  call<T = unknown>(cmd: string, params: Record<string, unknown> = {}, timeoutMs = 30000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!this.ensure() || !this.proc) {
        reject(new Error('agent non disponibile'))
        return
      }
      const id = ++this.seq
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error('timeout agent'))
      }, timeoutMs)
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer })
      try {
        this.proc.stdin.write(JSON.stringify({ id, cmd, ...params }) + '\n')
      } catch (e) {
        this.pending.delete(id)
        clearTimeout(timer)
        reject(e as Error)
      }
    })
  }

  // Come call ma non lancia: ritorna fallback se l'agent non è disponibile o va in errore.
  async tryCall<T>(cmd: string, params: Record<string, unknown>, fallback: T, timeoutMs?: number): Promise<T> {
    try {
      return await this.call<T>(cmd, params, timeoutMs)
    } catch {
      return fallback
    }
  }

  stop(): void {
    if (!this.proc) return
    try {
      this.proc.stdin.end()
    } catch {
      /* noop */
    }
    try {
      this.proc.kill()
    } catch {
      /* noop */
    }
    this.proc = null
  }
}

export const agent = new DeviceAgent()
