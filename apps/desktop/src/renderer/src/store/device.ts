import { create } from 'zustand'
import type { DeviceStatus } from '../types'

// Stato del dispositivo con polling continuo: l'app controlla di continuo se un
// iPhone è collegato/autorizzato, così collegamenti e ricollegamenti vengono
// rilevati automaticamente entro pochi secondi (niente refresh manuale).
interface DeviceStore {
  status: DeviceStatus | null
  refresh: () => Promise<void>
  start: () => void
  stop: () => void
}

let timer: ReturnType<typeof setInterval> | null = null
let inFlight = false

export const useDevice = create<DeviceStore>((set, get) => ({
  status: null,
  refresh: async () => {
    if (inFlight) return // niente chiamate sovrapposte: il probe può durare 1-2s
    inFlight = true
    try {
      const s = (await window.fp.device.status()) as DeviceStatus
      set({ status: s })
    } catch {
      /* riproviamo al prossimo tick */
    } finally {
      inFlight = false
    }
  },
  start: () => {
    if (timer) return
    void get().refresh()
    timer = setInterval(() => void get().refresh(), 2000)
  },
  stop: () => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  },
}))
