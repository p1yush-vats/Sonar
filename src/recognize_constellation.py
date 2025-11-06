import os, json, hashlib, time
import numpy as np
import torch, torchaudio
import sounddevice as sd
from scipy.io.wavfile import write
from collections import defaultdict, Counter

# ================== CONFIG ==================
SR = 22050
N_FFT = 2048
HOP = 512
PEAK_NEIGHBORHOOD = 20
AMP_DB_MIN = -35
FAN_VALUE = 15
MIN_TDELTA = 1
MAX_TDELTA = 200
INDEX_DIR = "constellation_index"
RECORD_SECONDS = 7
MIN_MATCHES = 20
# ============================================

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"🚀 Using device: {device}", flush=True)

# Prebuild GPU transforms
spec_tf = torchaudio.transforms.Spectrogram(n_fft=N_FFT, hop_length=HOP, power=None).to(device)
amp2db_tf = torchaudio.transforms.AmplitudeToDB(top_db=80).to(device)

# -------- FULL WARM-UP INIT (GPU + audio) --------
print("⚙️ Warming up DSP + Mic...", flush=True)
if device.type == "cuda":
    _dummy = torch.randn(1, SR, device=device)
    _ = spec_tf(_dummy.unsqueeze(0))
    _ = amp2db_tf(torch.abs(spec_tf(_dummy.unsqueeze(0))))

sd.query_devices()
sd.default.samplerate = 44100
try:
    sd.Stream(samplerate=44100, channels=1).close()
except:
    pass
print("✅ Ready.\n", flush=True)


# ---- DSP helpers ----
def spectrogram_db_from_tensor(wav, sr):
    if sr != SR:
        wav = torchaudio.functional.resample(wav, sr, SR)
    wav = torch.mean(wav, dim=0, keepdim=True).to(device)
    spec = spec_tf(wav)
    mag  = torch.abs(spec).squeeze(0)
    db   = amp2db_tf(mag)
    return db.detach().cpu().numpy()

def peak_coords(S_db):
    from scipy.ndimage import maximum_filter
    local_max = maximum_filter(S_db, size=PEAK_NEIGHBORHOOD) == S_db
    mask = S_db > AMP_DB_MIN
    peaks = np.argwhere(local_max & mask)
    if len(peaks): peaks = peaks[np.argsort(peaks[:, 1])]
    return peaks

def hashes_from_peaks(peaks):
    H = []
    L = len(peaks)
    hop_sec = HOP / SR
    for i in range(L):
        f1, t1 = peaks[i]
        for j in range(1, FAN_VALUE):
            if i+j >= L: break
            f2, t2 = peaks[i+j]
            dt = t2 - t1
            if MIN_TDELTA <= dt <= MAX_TDELTA:
                raw = f"{int(f1)}|{int(f2)}|{int(dt)}"
                h = hashlib.sha1(raw.encode()).hexdigest()[:20]
                H.append((h, t1 * hop_sec))
    return H


# ---- Audio record ----
def record_audio():
    try:
        import winsound
        print("🎤 Mic prepping...", flush=True)
        time.sleep(0.25)
        winsound.Beep(1000, 120)
    except:
        print("🎤 Mic prepping...", flush=True)
        time.sleep(0.25)

    print(f"🎤 Recording {RECORD_SECONDS}s...", flush=True)
    fs = 44100
    rec = sd.rec(int(RECORD_SECONDS * fs), samplerate=fs, channels=1, dtype='float32')
    sd.wait()
    write("query.wav", fs, rec)
    print("✅ Clip saved\n", flush=True)
    return "query.wav"


# ---- Load inverted index ----
def load_index():
    with open(os.path.join(INDEX_DIR, "inverted_index.json"), "r") as f:
        inv = json.load(f)
    with open(os.path.join(INDEX_DIR, "songs_meta.json"), "r") as f:
        meta = {m["id"]: m for m in json.load(f)}
    return inv, meta


# ---- Matching ----
def recognize(file, inv, meta_by_id):
    wav, sr = torchaudio.load(file)
    S_db = spectrogram_db_from_tensor(wav, sr)
    peaks = peak_coords(S_db)
    qhashes = hashes_from_peaks(peaks)

    votes = defaultdict(list)
    for h, qt in qhashes:
        for sid, dbt in inv.get(h, []):
            votes[sid].append(round(dbt - qt, 2))

    if not votes: return None, 0, 0

    best_sid, best_align, best_total = None, 0, 0
    for sid, deltas in votes.items():
        total = len(deltas)
        align = Counter(deltas).most_common(1)[0][1]
        if align > best_align or (align == best_align and total > best_total):
            best_sid, best_align, best_total = sid, align, total

    if best_align < MIN_MATCHES: return None, best_align, 0.0

    m = meta_by_id[int(best_sid)]
    conf = best_align / max(1, best_total)
    return m, best_align, conf


# ---- Main loop ----
if __name__ == "__main__":
    inv, meta = load_index()

    while True:
        print("\n🎧 Press ENTER to identify song (Ctrl+C to quit)")
        input()

        q = record_audio()

        print("🔍 Matching...", flush=True)
        match, align, conf = recognize(q, inv, meta)

        if match:
            print(f"\n✅ Song Recognized!")
            print(f"🎤 Artist: {match['artist']}")
            print(f"🎵 Title : {match['title']}")
            print(f"📊 Align : {align}")
            print(f"⚖️ Conf  : {conf:.2f}")
        else:
            print(f"\n❌ No confident match (align={align}) — try louder or closer.")
