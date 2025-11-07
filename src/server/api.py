# ==============================
# SONAR API v1.1 — Stable Release
# ==============================
import sys, os, json, gzip, pickle, base64, requests
import numpy as np
from collections import defaultdict, Counter
import torch, torchaudio
from datetime import datetime, timedelta
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import shutil, uuid, subprocess

# ------------------------------
# Load environment + Spotify keys
# ------------------------------
sys.path.append(os.path.abspath("."))
load_dotenv()

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")

from src.recognize_constellation import (
    HOP, SR, MIN_MATCHES,
    spectrogram_db_from_tensor, peak_coords, hashes_from_peaks
)

# ------------------------------
# CONFIG
# ------------------------------
INDEX_DIR = "constellation_index"
CACHE_FILE = "src/server/constellation_cache.pkl.gz"
USE_SPOTIFY_META = True  # Fetch album/cover/popularity
SERVER_READY = False

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"🚀 Using device: {device}", flush=True)


# =====================================================
# LOAD FINGERPRINT CACHE (GZIP AWARE)
# =====================================================
def load_index_fast():
    """Loads fingerprint cache from .pkl or .gz file."""
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


# =====================================================
# LOAD CACHE ON SERVER START
# =====================================================
print("🔧 Loading fingerprint DB into memory...")
try:
    inv, meta_by_id = load_index_fast()
    SERVER_READY = True
    print("✅ Index ready\n")
except Exception as e:
    print(f"❌ Failed to load cache: {e}")
    inv, meta_by_id = {}, {}
    SERVER_READY = False


# =====================================================
# SPOTIFY TOKEN HANDLER
# =====================================================
_spotify_token = None
_token_expiry = None

def get_spotify_token():
    """Fetch and cache Spotify token."""
    global _spotify_token, _token_expiry

    if _spotify_token and _token_expiry and datetime.utcnow() < _token_expiry:
        return _spotify_token

    if not SPOTIFY_CLIENT_ID or not SPOTIFY_CLIENT_SECRET:
        print("⚠️ Missing Spotify credentials.")
        return None

    auth_str = f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}"
    b64_auth = base64.b64encode(auth_str.encode()).decode()
    headers = {"Authorization": f"Basic {b64_auth}"}
    data = {"grant_type": "client_credentials"}

    res = requests.post("https://accounts.spotify.com/api/token", headers=headers, data=data, timeout=5)
    res.raise_for_status()
    token_data = res.json()
    _spotify_token = token_data["access_token"]
    _token_expiry = datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600))
    print("🔑 Spotify token refreshed.")
    return _spotify_token


# =====================================================
# FETCH SONG METADATA FROM SPOTIFY
# =====================================================
def get_spotify_metadata(artist, title):
    """Fetch album, cover art, preview, popularity."""
    try:
        token = get_spotify_token()
        if not token:
            return None

        headers = {"Authorization": f"Bearer {token}"}
        clean_title = title.replace(".wav", "").replace(".mp3", "").strip()
        query = f"track:{clean_title} artist:{artist}"

        res = requests.get(
            f"https://api.spotify.com/v1/search?q={query}&type=track&limit=5",
            headers=headers,
            timeout=5
        ).json()

        tracks = res.get("tracks", {}).get("items", [])
        if not tracks:
            print(f"⚠️ No Spotify match for: {artist} - {clean_title}")
            return None

        # Best match = matching artist + title
        best_track = None
        for t in tracks:
            if clean_title.lower() in t["name"].lower() and \
               any(artist.lower() in a["name"].lower() for a in t["artists"]):
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
# SONG RECOGNITION ENGINE
# =====================================================
def recognize_file(path):
    """Identify song from an audio file."""
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
    info["title"] = info["title"].replace(".wav", "").replace(".mp3", "").strip()

    if USE_SPOTIFY_META:
        meta = get_spotify_metadata(info["artist"], info["title"])
        if meta:
            info.update(meta)

    return info, best_align, confidence


# =====================================================
# FASTAPI SETUP
# =====================================================
app = FastAPI(title="SONAR Recognition API", version="1.1")

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


# =====================================================
# ROUTES
# =====================================================

@app.get("/ping")
async def ping():
    """Used by frontend intro screen to wait until backend is ready."""
    if not SERVER_READY:
        return {
            "status": "booting",
            "message": "Loading fingerprints into memory..."
        }
    return {
        "status": "ready",
        "songs_loaded": len(meta_by_id),
        "hash_buckets": len(inv),
        "device": str(device),
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/recognize")
async def recognize(audio: UploadFile = File(...)):
    """Receive audio, identify song, and return metadata."""
    if not SERVER_READY:
        return {"success": False, "message": "Server still booting"}

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
