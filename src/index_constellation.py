import os, json, hashlib
import numpy as np
import torch, torchaudio

# ================== CONFIG (must match recognizer) ==================
SR = 22050
N_FFT = 2048
HOP = 512
PEAK_NEIGHBORHOOD = 20      # local-max window (freq x time)
AMP_DB_MIN = -35            # ignore quiet pixels (raise to -30/-25 to be stricter)
FAN_VALUE = 15              # pairs per peak
MIN_TDELTA = 1              # min time delta (frames)
MAX_TDELTA = 200            # max time delta (frames)
DATASET_DIR = "dataset"
OUT_DIR = "constellation_index"
# ====================================================================

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"🚀 Using device: {device}")

# ---- warm up CUDA once to reduce first-call latency ----
if device.type == "cuda":
    _ = torch.randn(1, device=device)

# ---- Prebuild reusable GPU transforms ----
spec_tf = torchaudio.transforms.Spectrogram(n_fft=N_FFT, hop_length=HOP, power=None).to(device)
amp2db_tf = torchaudio.transforms.AmplitudeToDB(top_db=80).to(device)

def spectrogram_db(path):
    wav, sr = torchaudio.load(path)  # [C, T] on CPU
    if sr != SR:
        wav = torchaudio.functional.resample(wav, sr, SR)
    wav = torch.mean(wav, dim=0, keepdim=True).to(device)   # mono [1,T] on GPU
    spec = spec_tf(wav)                                     # complex spec
    mag = torch.abs(spec).squeeze(0)                        # [F,T]
    db  = amp2db_tf(mag)
    return db.detach().cpu().numpy()                        # numpy [F,T]

def peak_coords(S_db, neighborhood=PEAK_NEIGHBORHOOD, amp_min=AMP_DB_MIN):
    from scipy.ndimage import maximum_filter
    local_max = maximum_filter(S_db, size=neighborhood) == S_db
    mask = S_db > amp_min
    peaks = np.argwhere(local_max & mask)
    # sort by time index for stable pairing
    if len(peaks):
        peaks = peaks[np.argsort(peaks[:, 1])]
    return peaks  # columns: [freq_idx, time_idx]

def hashes_from_peaks(peaks):
    H = []
    L = len(peaks)
    hop_sec = HOP / SR
    for i in range(L):
        f1, t1 = peaks[i]
        for j in range(1, FAN_VALUE):
            if i + j >= L: break
            f2, t2 = peaks[i + j]
            dt = t2 - t1
            if MIN_TDELTA <= dt <= MAX_TDELTA:
                raw = f"{int(f1)}|{int(f2)}|{int(dt)}"
                h = hashlib.sha1(raw.encode()).hexdigest()[:20]
                H.append((h, t1 * hop_sec))  # store time in seconds
    return H

def build_index(dataset_dir=DATASET_DIR, out_dir=OUT_DIR):
    os.makedirs(out_dir, exist_ok=True)
    inv = {}   # inverted index: hash -> list of [song_id, t_sec]
    meta = []  # [{id, artist, title}...]
    sid = 0

    for artist in os.listdir(dataset_dir):
        adir = os.path.join(dataset_dir, artist)
        if not os.path.isdir(adir): continue
        for fname in os.listdir(adir):
            if not fname.lower().endswith(".wav"): continue
            fpath = os.path.join(adir, fname)
            title = os.path.splitext(fname)[0]
            song_id = sid; sid += 1
            print(f"🎵 Indexing: {artist} - {title}")

            S_db = spectrogram_db(fpath)
            peaks = peak_coords(S_db)
            if peaks.size == 0:
                print(f"… skipped (no peaks): {artist} - {title}")
                continue
            H = hashes_from_peaks(peaks)

            for h, t in H:
                inv.setdefault(h, []).append([song_id, t])

            meta.append({"id": song_id, "artist": artist, "title": title})

    with open(os.path.join(out_dir, "inverted_index.json"), "w", encoding="utf-8") as f:
        json.dump(inv, f)
    with open(os.path.join(out_dir, "songs_meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Saved index → {out_dir}/inverted_index.json")
    print(f"✅ Saved meta  → {out_dir}/songs_meta.json")

if __name__ == "__main__":
    build_index()
