import sys, os, json, gzip, pickle, base64, requests
import numpy as np
from collections import defaultdict, Counter
import torch, torchaudio
from datetime import datetime, timedelta
from dotenv import load_dotenv
# Add project root
sys.path.append(os.path.abspath("."))

from src.recognize_constellation import (
    HOP, SR, MIN_MATCHES,
    spectrogram_db_from_tensor, peak_coords, hashes_from_peaks
)
load_dotenv()

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
# ====================== CONFIG ======================
INDEX_DIR = "constellation_index"
CACHE_FILE = "src/server/constellation_cache.pkl.gz"   # gz for deployment
USE_SPOTIFY_META = True


device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"🚀 Using device: {device}", flush=True)

# =====================================================
# FAST INDEX LOADER (gzip-aware)
# =====================================================
def load_index_fast():
    if not os.path.exists(CACHE_FILE):
        raise FileNotFoundError(f"❌ Cache file not found: {CACHE_FILE}")

    print("🔧 Loading fingerprint cache...", flush=True)
    with open(CACHE_FILE, "rb") as f:
        magic = f.read(2)
    opener = gzip.open if magic == b"\x1f\x8b" else open

    with opener(CACHE_FILE, "rb") as f:
        obj = pickle.load(f)

    inv = obj["inv"]
    meta_by_id = obj["meta_by_id"]
    print(f"✅ Loaded {len(meta_by_id)} songs, {len(inv):,} hash buckets")
    return inv, meta_by_id


print("🔧 Loading fingerprint DB into memory...")
inv, meta_by_id = load_index_fast()
print("✅ Index ready\n")


# =====================================================
# SPOTIFY TOKEN CACHE
# =====================================================
_spotify_token = None
_token_expiry = None

def get_spotify_token():
    """Get and cache a Spotify app-only token for 1 hour."""
    global _spotify_token, _token_expiry

    if _spotify_token and _token_expiry and datetime.utcnow() < _token_expiry:
        return _spotify_token  # still valid

    auth_str = f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}"
    b64_auth = base64.b64encode(auth_str.encode()).decode()
    headers = {"Authorization": f"Basic {b64_auth}"}
    data = {"grant_type": "client_credentials"}

    res = requests.post("https://accounts.spotify.com/api/token", headers=headers, data=data, timeout=5)
    res.raise_for_status()
    token_data = res.json()
    _spotify_token = token_data["access_token"]
    _token_expiry = datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600))
    print("🔑 New Spotify token fetched.")
    return _spotify_token


# =====================================================
# SMART SPOTIFY METADATA FETCHER
# =====================================================
def get_spotify_metadata(artist, title):
    """Fetch accurate metadata (album, cover, preview, popularity) via Spotify API."""
    try:
        token = get_spotify_token()
        headers = {"Authorization": f"Bearer {token}"}

        # Clean and prepare query
        clean_title = title.replace(".wav", "").replace(".mp3", "").strip()
        query = f"track:{clean_title} artist:{artist}"

        res = requests.get(
            f"https://api.spotify.com/v1/search?q={query}&type=track&limit=5",
            headers=headers,
            timeout=5
        ).json()

        tracks = res.get("tracks", {}).get("items", [])
        if not tracks:
            print(f"⚠️ No Spotify match found for: {artist} - {clean_title}")
            return None

        # Try best match: exact title and artist match
        best_track = None
        for t in tracks:
            title_match = clean_title.lower() in t["name"].lower()
            artist_match = any(artist.lower() in a["name"].lower() for a in t["artists"])
            if title_match and artist_match:
                best_track = t
                break
        if not best_track:
            best_track = tracks[0]

        album = best_track["album"]
        return {
            "album": album.get("name"),
            "cover": album["images"][0]["url"] if album.get("images") else None,
            "release": album.get("release_date", "")[:10],
            "preview": best_track.get("preview_url"),
            "spotify_url": best_track["external_urls"]["spotify"],
            "popularity": best_track.get("popularity", 0),
        }

    except Exception as e:
        print(f"⚠️ Spotify metadata fetch failed: {e}")
        return None


# =====================================================
# MATCHING ENGINE
# =====================================================
def recognize_file(path):
    wav, sr = torchaudio.load(path)
    S_db = spectrogram_db_from_tensor(wav, sr)
    peaks = peak_coords(S_db)
    qhashes = hashes_from_peaks(peaks)

    votes = defaultdict(list)
    for h, qt in qhashes:
        arr = inv.get(h)
        if arr is None or arr.size == 0:
            continue
        sids = arr[:, 0].astype(np.int32)
        dbts = arr[:, 1]
        deltas = np.round(dbts - qt, 2)
        for sid, dt in zip(sids, deltas):
            votes[int(sid)].append(dt)

    if not votes:
        return None, 0, 0.0

    best_sid, best_align, best_total = None, 0, 0
    for sid, deltas in votes.items():
        total = len(deltas)
        align = Counter(deltas).most_common(1)[0][1]
        if align > best_align or (align == best_align and total > best_total):
            best_sid, best_align, best_total = sid, align, total

    if best_align < MIN_MATCHES:
        return None, best_align, 0.0

    info = meta_by_id[int(best_sid)]
    confidence = best_align / max(1, best_total)

    # Clean up title (remove .wav/.mp3)
    info["title"] = info["title"].replace(".wav", "").replace(".mp3", "").strip()

    # Add Spotify metadata
    if USE_SPOTIFY_META:
        meta = get_spotify_metadata(info["artist"], info["title"])
        if meta:
            info.update(meta)

    return info, best_align, confidence


# =====================================================
# FASTAPI APP
# =====================================================
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import shutil, uuid, subprocess

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "tmp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def convert_to_wav(src_path, dst_path):
    """Convert uploaded file to WAV using ffmpeg."""
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", src_path, "-ar", "44100", "-ac", "1", dst_path],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return True
    except Exception:
        return False


@app.post("/recognize")
async def recognize(audio: UploadFile = File(...)):
    """Handle uploaded clip and return recognition + Spotify metadata."""
    ext = audio.filename.split(".")[-1]
    temp_raw = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}.{ext}")
    temp_wav = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}.wav")

    with open(temp_raw, "wb") as buffer:
        shutil.copyfileobj(audio.file, buffer)

    convert_to_wav(temp_raw, temp_wav)

    try:
        match, align, conf = recognize_file(temp_wav)
    finally:
        if os.path.exists(temp_raw): os.remove(temp_raw)
        if os.path.exists(temp_wav): os.remove(temp_wav)

    if not match:
        return {"success": False, "message": "no_match"}

    return {
        "success": True,
        "artist": match["artist"],
        "title": match["title"],
        "album": match.get("album"),
        "cover": match.get("cover"),
        "preview": match.get("preview"),
        "release": match.get("release"),
        "spotify_url": match.get("spotify_url"),
        "popularity": match.get("popularity"),
        "align": align,
        "confidence": conf,
    }
