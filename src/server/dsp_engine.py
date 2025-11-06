import sys, os
sys.path.append(os.path.abspath("."))

import json, hashlib
from collections import defaultdict, Counter
import torch, torchaudio
from src.recognize_constellation import (
    HOP, SR, MIN_MATCHES,
    spectrogram_db_from_tensor, peak_coords, hashes_from_peaks
)


INDEX_DIR = "constellation_index"

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

def load_index():
    with open(os.path.join(INDEX_DIR, "inverted_index.json")) as f:
        inv = json.load(f)
    with open(os.path.join(INDEX_DIR, "songs_meta.json")) as f:
        meta = json.load(f)
    return inv, {m["id"]: m for m in meta}

print("🔧 Loading fingerprint DB in memory...")
inv, meta_by_id = load_index()
print(f"✅ Loaded {len(meta_by_id)} songs")


def recognize_file(path):
    wav, sr = torchaudio.load(path)
    S_db = spectrogram_db_from_tensor(wav, sr)
    peaks = peak_coords(S_db)
    qhashes = hashes_from_peaks(peaks)

    votes = defaultdict(list)
    for h, qt in qhashes:
        for sid, dbt in inv.get(h, []):
            votes[sid].append(round(dbt - qt, 2))

    if not votes:
        return None, 0, 0

    best_sid, best_align, best_total = None, 0, 0
    for sid, deltas in votes.items():
        total = len(deltas)
        align = Counter(deltas).most_common(1)[0][1]
        if align > best_align or (align == best_align and total > best_total):
            best_sid, best_align, best_total = sid, align, total

    if best_align < MIN_MATCHES:
        return None, best_align, 0

    info = meta_by_id[int(best_sid)]
    confidence = best_align / max(1, best_total)
    return info, best_align, confidence
