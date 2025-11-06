import os, numpy as np, pickle

FINGERPRINT_DIR = "fingerprints"
CACHE_FILE = "src/server/fingerprint_cache.pkl"

def build_cache():
    cache = []
    for root, _, files in os.walk(FINGERPRINT_DIR):
        for f in files:
            if not f.endswith(".npy"): continue
            path = os.path.join(root, f)
            data = np.load(path)
            artist = os.path.basename(os.path.dirname(path))
            title = os.path.splitext(f)[0]
            cache.append({
                "artist": artist,
                "title": title,
                "fingerprint": data
            })

    with open(CACHE_FILE, "wb") as f:
        pickle.dump(cache, f)
    print(f"✅ Cached {len(cache)} fingerprints to {CACHE_FILE}")

if __name__ == "__main__":
    build_cache()
