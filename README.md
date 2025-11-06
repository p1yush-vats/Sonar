# 🎧 SONAR — AI-Powered Music Recognition System

**SONAR** is a full-stack, open-source music recognition system that identifies songs from short microphone clips — inspired by Shazam's constellation fingerprinting algorithm.  
It combines **FastAPI**, **PyTorch**, **Torchaudio**, and **Spotify integration** on the backend with a **React + TailwindCSS** frontend for a sleek, real-time experience.

---

## 🧠 Overview

SONAR listens to a short audio clip (around 7 seconds), converts it into a **spectrogram**, and extracts distinct high-energy peaks. It then transforms these into a **constellation map** (unique time–frequency pairs) and hashes them to form a compact **audio fingerprint**.

These fingerprints are compared against a prebuilt database of songs stored in a **binary index cache**, allowing the app to identify the closest match within seconds — even with background noise or microphone distortion.

Once matched, SONAR automatically fetches the song's metadata — album art, release date, Spotify link, and popularity score — giving you an immersive identification experience.

---

## ⚙️ Features

### 🔍 Audio Recognition
- Identifies songs from 5–7 second audio clips
- Fast GPU-accelerated signal processing using **PyTorch + CUDA**
- Robust fingerprinting against noise and tempo variations

### 💿 Metadata Integration
- Fetches **album name**, **cover art**, **release date**, and **Spotify URL**
- Displays **Spotify popularity score**
- Optionally uses **iTunes API** as fallback if Spotify data unavailable

### 💾 Efficient Storage
- All fingerprints precomputed into a **1.2 GB constellation cache** (`.pkl.gz`)
- Loaded into memory once at startup for near-instant recognition
- Rebuild scripts available for creating your own dataset

### 🧩 Modular Architecture
- `src/server/` → FastAPI backend
- `frontend/` → React + Tailwind interface
- `dataset/` → Local audio files for fingerprinting
- `constellation_index/` → Generated hash and metadata maps

### 🖥️ Modern UI
- Smooth neon–glass visual theme
- Animated scanning orb inspired by Shazam
- Persistent recognition history and chart mockups

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|-------------|
| **Backend** | FastAPI, PyTorch, Torchaudio, NumPy, SciPy |
| **Frontend** | React (Vite), Tailwind CSS, Lucide React |
| **Metadata** | Spotify API (Spotipy), iTunes REST API |
| **Audio Processing** | FFT Spectrograms + Constellation Fingerprinting |
| **Deployment** | Uvicorn / Gunicorn, Python 3.10+, Node 20+ |

---

## 🗂️ Project Structure

```
SONAR/
│
├── src/
│   ├── server/
│   │   ├── api.py                           # FastAPI backend (main API)
│   │   ├── dsp_engine.py                    # DSP utilities
│   │   ├── recognize_constellation.py       # Recognition logic
│   │   └── constellation_cache.pkl.gz       # Prebuilt fingerprint cache (ignored)
│   │
│   ├── utils/
│   │   ├── build_fingerprint_cache.py
│   │   ├── build_constellation_cache.py
│   │   └── collect_dataset.py               # Builds dataset from Spotify/YouTube
│   │
│   └── ...
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                          # React app entry
│   │   ├── components/                      # UI sections
│   │   └── index.css
│   ├── package.json
│   └── tailwind.config.js
│
├── .env                                     # Spotify API keys (ignored)
├── .gitignore
├── requirements.txt
└── README.md
```

---

## 🚀 Setup & Installation

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/sonar.git
cd sonar
```

---

### 2️⃣ Backend Setup (FastAPI + Python)

#### Create a virtual environment:

```bash
python -m venv venv
venv\Scripts\activate      # (Windows)
# or
source venv/bin/activate   # (Mac/Linux)
```

#### Install dependencies:

```bash
pip install -r requirements.txt
```

#### Create a `.env` file:

```env
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

#### Run the API:

```bash
uvicorn src.server.api:app --reload
```

The backend will start on **`http://127.0.0.1:8000`**.

---

### 3️⃣ Frontend Setup (React + Vite)

#### Move into frontend folder:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on **`http://localhost:5173`**.

---

## 🎼 Building Your Own Fingerprint Database

If you want to identify your own playlist:

### 1️⃣ Download Songs

In `src/utils/collect_dataset.py`, edit your playlist URL and run:

```bash
python src/utils/collect_dataset.py
```

This fetches `.wav` files from YouTube based on Spotify playlist info.

---

### 2️⃣ Build Constellation Index

```bash
python src/utils/build_index.py
```

Generates `inverted_index.json` and `songs_meta.json`.

---

### 3️⃣ Compress into Cache

```bash
python src/utils/build_constellation_cache.py
```

This creates the binary `constellation_cache.pkl.gz` used by the backend.

---

## 🧬 How SONAR Works (Under the Hood)

SONAR follows the **constellation map algorithm** used in real acoustic fingerprinting systems:

1. 🎧 **Audio Input** — a short audio clip (5–10 seconds) is recorded.
2. 🎛 **Spectrogram Generation** — using **Short-Time Fourier Transform (STFT)**.
3. 🌌 **Peak Detection** — detects high-energy local maxima within a neighborhood window.
4. 🔑 **Fingerprint Hashing** — each pair of peaks forms a unique hash based on `(f1, f2, Δt)`.
5. 🧠 **Matching** — query hashes are compared against the indexed song database.
6. 📊 **Alignment Voting** — the most consistent time-offset alignment across hashes indicates the best match.

This approach is:

- **Noise robust** — ignores minor distortion or EQ changes
- **Tempo invariant** — matching based on time differences, not absolute timestamps
- **Compact** — each song is stored as a few thousand hashes, not raw audio

---

## 🧩 Example Response (API)

```json
{
  "success": true,
  "artist": "Kanye West",
  "title": "Heartless",
  "album": "808s & Heartbreak",
  "cover": "https://i.scdn.co/image/ab67616d0000b273346d77e155d854735410ed18",
  "release": "2008-11-24",
  "spotify_url": "https://open.spotify.com/track/4EWCNWgDS8707fNSZ1oaA5",
  "popularity": 84,
  "align": 84,
  "confidence": 0.12
}
```

---

## 🧾 Notes for Developers

- The `.pkl.gz` fingerprint cache is **ignored in GitHub** (too large). If you fork SONAR, follow the rebuild steps to generate your own cache.

- The `.env` file must never be committed — it contains Spotify credentials.

- Backend and frontend communicate over CORS (`http://localhost:8000` ↔ `http://localhost:5173`).

---

## 🧠 Future Roadmap (v2 Ideas)

- 🌐 Deployable cloud version with persistent API cache
- 🎚️ Spectrogram visualizer showing query–match overlap
- 🎵 Audio preview + waveform playback
- 📈 Global "Top Recognized Songs" chart
- 🔒 Account login + recognition history syncing

---

## 🧑‍💻 Authors

**Piyush [@p1yush-vats]**  
Developer & Designer — SONAR AI Project  
Built with ❤️ using FastAPI, PyTorch, and React.

---

## 🪪 License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

---

> *"The beauty of sound is that it leaves no trace — unless you teach your code to remember it."*  
> — SONAR Team
