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

# Decoder HEIC/HEIF (le foto iPhone sono quasi tutte HEIC; ffmpeg non le apre).
try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except Exception:
    pass

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


class Agent:
    def __init__(self):
        self.ld = None
        self.udid = None
        self.afc_svc = None

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
        self.afc_svc = AfcService(lockdown=self.ld)
        return self.afc_svc

    async def status(self):
        udid = await self._first_udid()
        if not udid:
            self._reset()
            return {'connected': False, 'trusted': False}
        try:
            ld = await self.ensure_lockdown(udid)
        except Exception:
            self._reset()
            return {'connected': True, 'trusted': False, 'udid': udid}
        try:
            name = await aw(ld.get_value(key='DeviceName'))
            du = await aw(ld.get_value(domain='com.apple.disk_usage'))
        except Exception:
            self._reset()
            return {'connected': True, 'trusted': False, 'udid': udid}
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
                for f in files:
                    if f in ('.', '..') or '.' not in f:
                        continue
                    t = ftype(f)
                    if t == 'file':
                        continue
                    rel = d + '/' + f
                    size, date = 0, ''
                    try:
                        st = await aw(afc.stat('/DCIM/' + rel))
                        size = st.get('st_size', 0)
                        date = self._date(st)
                    except Exception:
                        pass
                    items.append({
                        'id': rel, 'name': f, 'type': t, 'sizeBytes': size, 'date': date,
                        'kind': 'video' if t == 'video' else f.rsplit('.', 1)[-1].upper(),
                    })
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
        data = await aw(afc.get_file_contents(remote))
        with open(dest, 'wb') as f:
            f.write(data)
        return {'path': dest, 'size': len(data)}

    async def rm(self, remote):
        afc = await self.afc()
        try:
            await aw(afc.rm(remote))
        except Exception:
            await aw(afc.rm_single(remote))
        return {'ok': True}

    async def thumb(self, remote, size=256):
        # Scarica il file via AFC e genera una miniatura JPEG (HEIC inclusi).
        afc = await self.afc()
        data = await aw(afc.get_file_contents(remote))
        from PIL import Image
        im = Image.open(io.BytesIO(data))
        im.thumbnail((size, size))
        buf = io.BytesIO()
        im.convert('RGB').save(buf, 'JPEG', quality=72)
        return {'b64': base64.b64encode(buf.getvalue()).decode('ascii')}

    async def analyze(self, ids):
        # Per ogni foto: dHash percettivo (duplicati) + luminosità/varianza (foto nere/vuote).
        afc = await self.afc()
        from PIL import Image, ImageStat
        out = []
        for fid in ids:
            try:
                data = await aw(afc.get_file_contents('/DCIM/' + fid))
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
            except Exception:
                out.append({'id': fid})
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


async def dispatch(agent, req):
    cmd = req.get('cmd')
    if cmd == 'status':
        return await agent.status()
    if cmd == 'list':
        return await agent.listing(req.get('source', 'photos'))
    if cmd == 'browse':
        return await agent.browse(req.get('path', ''))
    if cmd == 'analyze':
        return await agent.analyze(req.get('ids', []))
    if cmd == 'pull':
        return await agent.pull(req['remote'], req['dest'])
    if cmd == 'rm':
        return await agent.rm(req['remote'])
    if cmd == 'thumb':
        return await agent.thumb(req['remote'], int(req.get('size', 256)))
    if cmd == 'pair':
        return await agent.pair()
    if cmd == 'ping':
        return {'pong': True}
    raise ValueError('comando sconosciuto: ' + str(cmd))


async def main():
    agent = Agent()
    loop = asyncio.get_running_loop()
    asyncio.create_task(_watch_parent())
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
        rid = req.get('id')
        try:
            res = await dispatch(agent, req)
            out = {'id': rid, 'ok': True, 'result': res}
        except Exception as e:
            out = {'id': rid, 'ok': False, 'error': str(e)}
        sys.stdout.write(json.dumps(out) + '\n')
        sys.stdout.flush()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, BrokenPipeError):
        pass
