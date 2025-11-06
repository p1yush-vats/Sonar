# src/utils/build_constellation_cache.py
import os, json, pickle, numpy as np

INDEX_DIR = "constellation_index"
OUT_FILE = "src/server/constellation_cache.pkl"  # uncompressed pickle

def build_cache():
    inv_path = os.path.join(INDEX_DIR, "inverted_index.json")
    meta_path = os.path.join(INDEX_DIR, "songs_meta.json")

    assert os.path.exists(inv_path), f"Missing {inv_path}"
    assert os.path.exists(meta_path), f"Missing {meta_path}"

    print("Loading JSON index (this may take a moment)...")
    with open(inv_path, "r", encoding="utf-8") as f:
        inv_json = json.load(f)

    with open(meta_path, "r", encoding="utf-8") as f:
        meta_list = json.load(f)

    print("Converting to compact numpy arrays...")
    # Convert inverted index values to small numpy arrays
    inv = {}
    for h, entries in inv_json.items():
        # entries are [[song_id, t_sec], [song_id, t_sec], ...]
        inv[h] = np.array(entries, dtype=np.float32)

    # meta_by_id as dict for O(1) lookup
    meta_by_id = {int(m["id"]): m for m in meta_list}

    print(f"Packed {len(inv)} hashes; {len(meta_by_id)} songs")

    print(f"Writing cache → {OUT_FILE}")
    with open(OUT_FILE, "wb") as f:
        pickle.dump({"inv": inv, "meta_by_id": meta_by_id}, f, protocol=5)

    print("✅ Cache built successfully!")

if __name__ == "__main__":
    build_cache()
