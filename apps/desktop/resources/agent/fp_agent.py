"""FreshPhone device agent — processo Python persistente.

Mantiene UNA sessione pymobiledevice3 (usbmux/lockdown/AFC) viva e risponde a
comandi JSON (uno per riga) su stdin, scrivendo risposte JSON (una per riga) su
stdout. Così evitiamo l'avvio di Python a ogni chiamata (lento) e le sessioni
lockdown concorrenti (che facevano "lampeggiare" il trust).

Protocollo:
  richiesta:  {"id": <n>, "cmd": "status|list|pair|pull|rm|ping", ...}
  risposta:   {"id": <n>, "ok": true, "result": <...>}  |  {"id": <n>, "ok": false, "error": "..."}
"""
import sys, os, json, asyncio, io, base64, ctypes

# Il protocollo JSON viaggia su stdout. Librerie come onnxruntime/insightface stampano
# diagnostica su stdout (anche a livello C): la dirotteremmo nel canale corrompendo le
# risposte. Salviamo lo stdout reale per il protocollo e mandiamo TUTTO il resto su stderr.
_proto_fd = os.dup(1)
os.dup2(2, 1)
_PROTO = os.fdopen(_proto_fd, 'w', buffering=1, encoding='utf-8', errors='replace')

# Decoder HEIC/HEIF (le foto iPhone sono quasi tutte HEIC; ffmpeg non le apre).
try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except Exception:
    pass

# Modello volti: import a livello di modulo (PRIMA dell'event loop). Importare
# insightface/onnxruntime mentre il loop asyncio gira si blocca su Windows.
try:
    from insightface.app import FaceAnalysis as _FaceAnalysis
except Exception:
    _FaceAnalysis = None

# PID del processo padre (Electron): se muore, l'agent si auto-termina (niente orfani).
try:
    PARENT_PID = int(sys.argv[1]) if len(sys.argv) > 1 else None
except Exception:
    PARENT_PID = None


def _parent_alive():
    if PARENT_PID is None:
        return True
    if sys.platform == 'win32':
        k = ctypes.windll.kernel32
        h = k.OpenProcess(0x1000, False, PARENT_PID)  # PROCESS_QUERY_LIMITED_INFORMATION
        if not h:
            return False
        code = ctypes.c_ulong()
        k.GetExitCodeProcess(h, ctypes.byref(code))
        k.CloseHandle(h)
        return code.value == 259  # STILL_ACTIVE
    try:
        os.kill(PARENT_PID, 0)
        return True
    except Exception:
        return False


async def _watch_parent():
    while True:
        await asyncio.sleep(3)
        if not _parent_alive():
            os._exit(0)


async def aw(x):
    return await x if asyncio.iscoroutine(x) else x


PHOTO_EXT = {'heic', 'heif', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'dng', 'tiff'}
VIDEO_EXT = {'mov', 'mp4', 'm4v', 'avi'}

# File "personali" mostrati nella sezione File (documenti, audio, immagini salvate…).
PERSONAL_EXT = {
    'pdf', 'doc', 'docx', 'txt', 'rtf', 'epub', 'pages', 'key', 'numbers', 'mobi', 'md',
    'csv', 'xls', 'xlsx', 'ppt', 'pptx', 'json', 'xml', 'html', 'zip', 'rar', '7z',
    'mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'aiff',
    'jpg', 'jpeg', 'png', 'gif', 'heic', 'webp', 'bmp', 'tiff',
}
# Cartelle di sistema da nascondere nella sezione File.
SKIP_DIRS = {
    'PhotoData', 'iTunes_Control', 'DCIM', 'Photos', '.MISC', 'MediaAnalysis',
    'com.apple.itunes.lock_sync', 'Purchases', 'Radio', 'ApplicationArchives',
    'Safari', 'Logs', 'Keyboard', 'Sounds', 'Recordings',
}


def ftype(name):
    ext = name.rsplit('.', 1)[-1].lower() if '.' in name else ''
    if ext in PHOTO_EXT:
        return 'photo'
    if ext in VIDEO_EXT:
        return 'video'
    return 'file'


def _make_thumb(data, size):
    # Decodifica + ridimensiona (girata in un thread executor: non blocca il loop
    # e più anteprime vengono elaborate in parallelo).
    from PIL import Image
    im = Image.open(io.BytesIO(data))
    im.thumbnail((size, size))
    buf = io.BytesIO()
    im.convert('RGB').save(buf, 'JPEG', quality=72)
    return base64.b64encode(buf.getvalue()).decode('ascii')


class Agent:
    def __init__(self):
        self.ld = None
        self.udid = None
        self.afc_svc = None
        self.afc_lock = asyncio.Lock()   # le operazioni AFC condividono un socket: mai interlacciarle
        self.conn_lock = asyncio.Lock()  # una sola creazione lockdown alla volta
        self.decode_sem = asyncio.Semaphore(4)  # decodifiche anteprime in parallelo (CPU)
        self.face_app = None             # modello volti InsightFace (caricato pigro)

    def _reset(self):
        self.ld = None
        self.udid = None
        self.afc_svc = None

    async def devices(self):
        from pymobiledevice3.usbmux import list_devices
        return await aw(list_devices())

    async def _first_udid(self):
        devs = await self.devices()
        cand = [d for d in devs if getattr(d, 'is_usb', True)] or devs
        return getattr(cand[0], 'serial', None) if cand else None

    async def ensure_lockdown(self, udid):
        if self.ld is not None and self.udid == udid:
            return self.ld
        async with self.conn_lock:  # double-checked: evita creazioni concorrenti
            if self.ld is not None and self.udid == udid:
                return self.ld
            from pymobiledevice3.lockdown import create_using_usbmux
            self.ld = await aw(create_using_usbmux(serial=udid))
            self.udid = udid
            self.afc_svc = None
            return self.ld

    async def afc(self):
        if self.afc_svc is not None:
            return self.afc_svc
        if self.ld is None:
            udid = await self._first_udid()
            if not udid:
                raise RuntimeError('Nessun dispositivo collegato')
            await self.ensure_lockdown(udid)
        from pymobiledevice3.services.afc import AfcService
        import pymobiledevice3.services.afc as _afcmod
        _afcmod.MAXIMUM_READ_SIZE = 16 * 1024 * 1024  # blocchi da 16MB: meno round-trip, più veloce
        self.afc_svc = AfcService(lockdown=self.ld)
        return self.afc_svc

    async def status(self):
        # Via veloce: se la lockdown è già viva la interroghiamo direttamente, senza
        # enumerare usbmux a ogni poll (meno carico USB, meno falsi "disconnesso").
        if self.ld is not None:
            try:
                return await self._device_info(self.ld, self.udid)
            except Exception:
                self._reset()  # lockdown caduta: si ricostruisce qui sotto
        udid = await self._first_udid()
        if not udid:
            self._reset()
            return {'connected': False, 'trusted': False}
        try:
            ld = await self.ensure_lockdown(udid)
            return await self._device_info(ld, udid)
        except Exception:
            self._reset()
            return {'connected': True, 'trusted': False, 'udid': udid}

    async def _device_info(self, ld, udid):
        name = await aw(ld.get_value(key='DeviceName'))
        du = await aw(ld.get_value(domain='com.apple.disk_usage'))
        total = du.get('TotalDiskCapacity')
        free = du.get('AmountDataAvailable')  # spazio realmente libero (come iOS)
        used = (total - free) if (total is not None and free is not None) else None
        return {
            'connected': True, 'trusted': True, 'udid': udid, 'name': name,
            'usedBytes': used, 'totalBytes': total, 'freeBytes': free,
        }

    @staticmethod
    def _date(st):
        d = st.get('st_birthtime') or st.get('st_mtime')
        try:
            return d.isoformat()
        except Exception:
            return str(d) if d else ''

    async def listing(self, source):
        afc = await self.afc()
        items = []
        if source == 'photos':
            try:
                dirs = await aw(afc.listdir('/DCIM'))
            except Exception:
                dirs = []
            for d in dirs:
                if d in ('.', '..') or '.' in d:  # salta file sparsi e .MISC
                    continue
                try:
                    files = await aw(afc.listdir('/DCIM/' + d))
                except Exception:
                    continue
                # Riconoscimento Live Photo: il MOV omonimo di una foto è la sua parte
                # "motion", non un video a sé. Indicizziamo gli still e i MOV per nome base.
                stills = set()
                mov_by_base = {}
                for f in files:
                    if '.' not in f:
                        continue
                    base = f.rsplit('.', 1)[0].lower()
                    ext = f.rsplit('.', 1)[-1].lower()
                    if ext in PHOTO_EXT:
                        stills.add(base)
                    elif ext == 'mov':
                        mov_by_base[base] = f
                for f in files:
                    if f in ('.', '..') or '.' not in f:
                        continue
                    t = ftype(f)
                    if t == 'file':
                        continue
                    base = f.rsplit('.', 1)[0].lower()
                    ext = f.rsplit('.', 1)[-1].lower()
                    if ext == 'mov' and base in stills:
                        continue  # parte motion di una Live Photo: non è un video separato
                    rel = d + '/' + f
                    size, date = 0, ''
                    try:
                        st = await aw(afc.stat('/DCIM/' + rel))
                        size = st.get('st_size', 0)
                        date = self._date(st)
                    except Exception:
                        pass
                    item = {
                        'id': rel, 'name': f, 'type': t, 'sizeBytes': size, 'date': date,
                        'kind': 'video' if t == 'video' else f.rsplit('.', 1)[-1].upper(),
                    }
                    if t == 'photo' and base in mov_by_base:  # foto con MOV omonimo = Live Photo
                        item['live'] = True
                        item['liveMov'] = d + '/' + mov_by_base[base]
                    items.append(item)
        else:
            return await self.personal_files()
        return items

    async def personal_files(self):
        afc = await self.afc()
        items = []

        async def walk(path, depth):
            if depth > 4:
                return
            try:
                names = await aw(afc.listdir(path))
            except Exception:
                return
            for n in names:
                if n in ('.', '..') or n.startswith('.'):
                    continue
                full = path.rstrip('/') + '/' + n
                try:
                    st = await aw(afc.stat(full))
                except Exception:
                    continue
                if st.get('st_ifmt') == 'S_IFDIR':
                    if n in SKIP_DIRS:
                        continue
                    await walk(full, depth + 1)
                else:
                    ext = n.rsplit('.', 1)[-1].lower() if '.' in n else ''
                    if ext in PERSONAL_EXT:
                        items.append({
                            'id': full.lstrip('/'), 'name': n, 'type': ftype(n),
                            'sizeBytes': st.get('st_size', 0), 'date': self._date(st),
                            'kind': ext.upper(),
                        })

        await walk('/', 0)
        return items

    async def browse(self, path):
        # Elenca le voci (cartelle + file) sotto un percorso della media partition.
        afc = await self.afc()
        p = path if path.startswith('/') else '/' + path
        if not p.endswith('/'):
            p += '/'
        items = []
        try:
            names = await aw(afc.listdir(p))
        except Exception:
            names = []
        for n in names:
            if n in ('.', '..'):
                continue
            size, date, is_dir = 0, '', False
            try:
                st = await aw(afc.stat(p + n))
                is_dir = st.get('st_ifmt') == 'S_IFDIR'
                size = st.get('st_size', 0)
                date = self._date(st)
            except Exception:
                pass
            rel = (p + n).lstrip('/')
            items.append({
                'id': rel, 'name': n, 'type': 'folder' if is_dir else ftype(n), 'isDir': is_dir,
                'sizeBytes': size, 'date': date,
                'kind': 'cartella' if is_dir else (n.rsplit('.', 1)[-1].upper() if '.' in n else ''),
            })
        return items

    async def pull(self, remote, dest):
        afc = await self.afc()
        # afc.pull legge a blocchi e scrive DIRETTAMENTE su disco: niente file intero
        # in RAM né l'accumulo quadratico 'data += chunk' di get_file_contents
        # (era lentissimo sui video grandi). Preserva anche la data di modifica.
        await aw(afc.pull(remote, dest, progress_bar=False))
        try:
            size = os.path.getsize(dest)
        except Exception:
            size = 0
        return {'path': dest, 'size': size}

    async def rm(self, remote):
        afc = await self.afc()
        try:
            await aw(afc.rm(remote))
        except Exception:
            await aw(afc.rm_single(remote))
        return {'ok': True}

    async def thumb(self, remote, size=256):
        # Download veloce sotto il lock AFC (un solo socket), con auto-recovery se la
        # sessione cade; poi la decodifica (la parte lenta) avviene FUORI dal lock e
        # in un thread, così più anteprime si elaborano in parallelo.
        async with self.afc_lock:
            try:
                afc = await self.afc()
                data = await asyncio.wait_for(aw(afc.get_file_contents(remote)), timeout=20)
            except Exception:
                await self._drop_afc()
                afc = await self.afc()
                data = await asyncio.wait_for(aw(afc.get_file_contents(remote)), timeout=20)
        loop = asyncio.get_running_loop()
        async with self.decode_sem:
            b64 = await loop.run_in_executor(None, _make_thumb, data, size)
        return {'b64': b64}

    async def analyze(self, ids):
        # Per ogni foto: dHash percettivo (duplicati) + luminosità/varianza (foto nere/vuote).
        afc = await self.afc()
        from PIL import Image, ImageStat
        out = []
        fails = 0
        for fid in ids:
            try:
                data = await asyncio.wait_for(aw(afc.get_file_contents('/DCIM/' + fid)), timeout=10)
                im = Image.open(io.BytesIO(data)).convert('L')
                stat = ImageStat.Stat(im)
                small = im.resize((9, 8))
                px = list(small.getdata())
                bits = 0
                for row in range(8):
                    base = row * 9
                    for col in range(8):
                        bits = (bits << 1) | (1 if px[base + col] > px[base + col + 1] else 0)
                out.append({'id': fid, 'bright': round(stat.mean[0], 1), 'std': round(stat.stddev[0], 1), 'hash': '%016x' % bits})
                fails = 0
            except Exception:
                # Immagine illeggibile: la SALTIAMO (niente riga, così non finisce in
                # cache come "fatta" e verrà riprovata). Troppi errori di fila = la
                # sessione AFC è caduta: rilanciamo per attivare l'auto-recovery di run_afc.
                fails += 1
                if fails >= 3:
                    raise RuntimeError('sessione AFC instabile durante analyze')
        return out

    def _ensure_face_app(self):
        # Carica il modello volti leggero (buffalo_sc: rilevamento + embedding) una
        # sola volta. Gira su CPU. Bloccante: chiamato in un thread executor.
        if self.face_app is not None:
            return self.face_app
        if _FaceAnalysis is None:
            raise RuntimeError('Modello volti non disponibile (insightface mancante)')
        app = _FaceAnalysis(name='buffalo_sc', providers=['CPUExecutionProvider'])
        app.prepare(ctx_id=-1, det_size=(640, 640))
        self.face_app = app
        return app

    def _detect_faces(self, data):
        # Rileva i volti e ne calcola l'impronta (512-d L2-normalizzata).
        import io as _io, base64 as _b64
        import numpy as np
        from PIL import Image
        im = Image.open(_io.BytesIO(data)).convert('RGB')
        im.thumbnail((1280, 1280))  # ridimensiona per velocità (ma abbastanza per i volti)
        # RGB -> BGR CONTIGUO: senza ascontiguousarray l'array ha stride negativo e
        # onnxruntime/opencv non lo accettano → 0 volti rilevati.
        arr = np.ascontiguousarray(np.asarray(im)[:, :, ::-1])
        out = []
        for f in self.face_app.get(arr):
            emb = f.normed_embedding.astype('float32')
            out.append({'emb': _b64.b64encode(emb.tobytes()).decode('ascii'), 'score': float(f.det_score)})
        return out

    async def faces(self, ids):
        # Modello + rilevamento sincroni: caricarli in un thread executor va in
        # deadlock con onnxruntime mentre l'executor serve già stdin.readline.
        # Il blocco del loop è breve e l'operazione è volontaria/una-tantum.
        self._ensure_face_app()
        out = []
        for fid in ids:
            try:
                async with self.afc_lock:
                    afc = await self.afc()
                    data = await asyncio.wait_for(aw(afc.get_file_contents('/DCIM/' + fid)), timeout=20)
                out.append({'id': fid, 'faces': self._detect_faces(data)})
            except Exception:
                out.append({'id': fid, 'faces': []})
        return out

    async def pair(self):
        udid = await self._first_udid()
        if not udid:
            return {'ok': False, 'message': 'Nessun dispositivo collegato'}
        try:
            self._reset()
            await self.ensure_lockdown(udid)
            return {'ok': True, 'message': 'Dispositivo autorizzato'}
        except Exception:
            return {'ok': False, 'message': 'Sblocca il telefono e tocca "Autorizza", poi riprova.'}

    async def run_afc(self, cmd, req):
        # Le operazioni AFC sono serializzate (un solo socket) e si auto-riparano:
        # se la sessione cade, la ricreiamo e riproviamo una volta. Così un colpo
        # su cavo/USB non lascia la libreria "in caricamento" per sempre.
        async with self.afc_lock:
            try:
                return await self._afc_dispatch(cmd, req)
            except Exception:
                await self._drop_afc()
                return await self._afc_dispatch(cmd, req)

    async def _drop_afc(self):
        # Chiude e scarta la sessione AFC morta (così il suo reader-loop non resta
        # orfano) mantenendo viva la lockdown — la usa status. afc() la ricrea.
        svc = self.afc_svc
        self.afc_svc = None
        if svc is not None:
            try:
                await aw(svc.close())
            except Exception:
                pass

    async def _afc_dispatch(self, cmd, req):
        if cmd == 'list':
            return await self.listing(req.get('source', 'photos'))
        if cmd == 'browse':
            return await self.browse(req.get('path', ''))
        if cmd == 'analyze':
            return await self.analyze(req.get('ids', []))
        if cmd == 'pull':
            return await self.pull(req['remote'], req['dest'])
        if cmd == 'rm':
            return await self.rm(req['remote'])
        raise ValueError('comando AFC sconosciuto: ' + str(cmd))


AFC_CMDS = {'list', 'browse', 'analyze', 'pull', 'rm'}


async def dispatch(agent, req):
    cmd = req.get('cmd')
    # I comandi AFC passano per run_afc (lock + auto-recovery). status/ping/pair
    # restano FUORI dal lock AFC: rispondono subito anche durante un pull pesante.
    if cmd in AFC_CMDS:
        return await agent.run_afc(cmd, req)
    if cmd == 'thumb':
        return await agent.thumb(req['remote'], int(req.get('size', 256)))
    if cmd == 'faces':
        return await agent.faces(req.get('ids', []))
    if cmd == 'status':
        return await agent.status()
    if cmd == 'pair':
        return await agent.pair()
    if cmd == 'ping':
        return {'pong': True}
    raise ValueError('comando sconosciuto: ' + str(cmd))


async def main():
    agent = Agent()
    loop = asyncio.get_running_loop()
    asyncio.create_task(_watch_parent())
    out_lock = asyncio.Lock()

    async def handle(req):
        rid = req.get('id')
        try:
            res = await dispatch(agent, req)
            out = {'id': rid, 'ok': True, 'result': res}
        except Exception as e:
            out = {'id': rid, 'ok': False, 'error': str(e)}
        async with out_lock:  # scritture atomiche sul canale protocollo (una riga per risposta)
            _PROTO.write(json.dumps(out) + '\n')
            _PROTO.flush()

    while True:
        line = await loop.run_in_executor(None, sys.stdin.readline)
        if line == '':
            break  # EOF: il padre ha chiuso lo stdin
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except Exception:
            continue
        # Ogni comando è un task indipendente: status/ping rispondono subito anche
        # mentre un 'pull'/'list'/'thumb' pesante tiene occupato il canale AFC.
        asyncio.create_task(handle(req))


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, BrokenPipeError):
        pass
