# resources/bin — strumenti per il dispositivo

FreshPhone usa strumenti a riga di comando per comunicare con l'iPhone. Mettili qui
(insieme alle loro DLL su Windows). In sviluppo questa cartella è
`apps/desktop/resources/bin`; nell'app pacchettizzata viene copiata in `resources/bin`.

## Necessari (rilevamento, trust, info, spazio) — libimobiledevice

Build Windows di libimobiledevice (con le DLL accanto):

- `idevice_id.exe` — elenco UDID dei dispositivi collegati
- `ideviceinfo.exe` — info dispositivo (nome, capacità/spazio)
- `idevicepair.exe` — pairing / verifica del Trust

Fonti consigliate: build Windows di libimobiledevice (es. progetti
"libimobiledevice-windows") oppure i binari distribuiti con strumenti compatibili.

## Consigliato (lettura contenuti via AFC) — pymobiledevice3

- `pymobiledevice3.exe` — usato per elencare `/DCIM` e il media partition

Puoi ottenerlo come eseguibile "frozen" (PyInstaller) oppure installarlo con
`pip install pymobiledevice3` e puntare FreshPhone all'eseguibile via variabile
d'ambiente (vedi sotto).

## Anteprime (HEIC/video) — ffmpeg (opzionale)

Le anteprime di JPEG/PNG sono generate da Electron senza dipendenze. Per **HEIC/HEIF** e i
**video** serve `ffmpeg.exe` in questa cartella (o su PATH). Senza ffmpeg, gli elementi
HEIC/video mostrano un riquadro colorato al posto della miniatura. Override:
`FRESHPHONE_FFMPEG`.

## Driver Apple

Su Windows serve l'**Apple Mobile Device USB Driver** (incluso nell'app "Apple Devices"
del Microsoft Store o in iTunes, oppure in pacchetti driver standalone). Senza, il PC
non comunica con l'iPhone.

## Override via variabili d'ambiente

Per puntare a un'installazione di sistema invece dei binari in questa cartella:

- `FRESHPHONE_IDEVICE_ID`, `FRESHPHONE_IDEVICEINFO`, `FRESHPHONE_IDEVICEPAIR`
- `FRESHPHONE_PYMOBILEDEVICE3`

## Stato

Se gli strumenti non sono presenti, FreshPhone resta utilizzabile in **modalità demo**
(Impostazioni → Dispositivo). Con i binari presenti e un iPhone collegato e autorizzato,
l'app rileva il dispositivo e mostra nome e spazio reali; la lettura AFC dei contenuti è
in fase di validazione on-device (anteprime e metadati completi nel passo successivo).
