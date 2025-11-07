import React, { useState, useEffect, useRef } from "react";
import {
  Home, Library, TrendingUp, User, Music,
  Heart, Share2, MoreVertical, ChevronRight, Play, AlertCircle, Waves,
  FileText
} from "lucide-react";
import ColorThief from "colorthief";
import IntroScreen from "./components/IntroScreen"; // ✅ Import new intro
import DocsTab from "./components/docs/DocsTab";

// ✅ Orb component
const SoundOrbIcon = ({ active }) => (
  <div className={`transition-all duration-500 ${active ? "scale-90" : ""}`}>
    <Waves className="w-28 h-28 text-[#6bffcb] drop-shadow-[0_0_20px_rgba(107,255,203,0.8)]" />
  </div>
);

export default function App() {
  const [booted, setBooted] = useState(false);
  const [tab, setTab] = useState("scan");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  if (!booted) return <IntroScreen onFinish={() => setBooted(true)} />;

  return (
    <div className="h-screen bg-gradient-to-b from-[#0d0f14] to-[#111923] text-white flex flex-col">

      <header className="p-4 flex items-center justify-between border-b border-white/10 backdrop-blur-xl">
  {/* SONAR logo - returns to home/scan */}
  <h1
    onClick={() => setTab("scan")}
    className="text-xl font-bold tracking-wider text-[#6bffcb] drop-shadow-[0_0_6px_#6bffcb] cursor-pointer select-none"
  >
    SONAR
  </h1>

  {/* Right-side controls */}
  <div className="flex items-center gap-4">
    {/* Docs access */}
    <button
      onClick={() => setTab("docs")}
      className={`transition-all duration-300 ${
        tab === "docs"
          ? "text-[#6bffcb] drop-shadow-[0_0_8px_#6bffcb] scale-110"
          : "text-gray-300 hover:text-[#6bffcb]/80"
      }`}
      title="Open Documentation"
    >
      <FileText className="w-6 h-6" />
    </button>

    {/* GitHub Profile */}
    <a
      href="https://github.com/p1yush-vats"
      target="_blank"
      rel="noreferrer"
      className="transition-all duration-300 text-gray-400 hover:text-[#6bffcb] hover:scale-110"
      title="View GitHub Profile"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="currentColor"
        viewBox="0 0 24 24"
        className="w-6 h-6"
      >
        <path
          fillRule="evenodd"
          d="M12 .5C5.65.5.5 5.65.5 12.02c0 5.1 3.29 9.42 7.86 10.95.58.1.79-.25.79-.55v-1.96c-3.2.7-3.88-1.55-3.88-1.55-.52-1.31-1.28-1.66-1.28-1.66-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.71 1.25 3.38.96.1-.75.4-1.26.73-1.55-2.56-.3-5.26-1.28-5.26-5.71 0-1.26.45-2.28 1.19-3.09-.12-.3-.52-1.5.12-3.14 0 0 .97-.31 3.18 1.18.92-.25 1.9-.38 2.87-.38.97 0 1.95.13 2.87.38 2.2-1.49 3.18-1.18 3.18-1.18.64 1.64.24 2.84.12 3.14.75.81 1.19 1.83 1.19 3.09 0 4.45-2.71 5.4-5.29 5.69.42.36.79 1.09.79 2.2v3.26c0 .3.21.65.8.55A10.53 10.53 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
        />
      </svg>
    </a>
  </div>
</header>


      {/* ✅ Main Tabs */}
      <div className="flex-1 overflow-y-auto relative">
        <div className="pb-24">
          {tab === "scan" && (
            <ScanTab
              result={result}
              setResult={setResult}
              history={history}
              setHistory={setHistory}
            />
          )}

          {tab === "library" && <LibraryTab history={history} />}
          {tab === "charts" && <ChartsTab />}
          {tab === "docs" && <DocsTab />} {/* ✅ now works */}
        </div>

        {/* Fade gradient */}
        <div className="fixed bottom-16 left-0 right-0 h-20 bg-gradient-to-t from-[#111923] via-[#111923]/80 to-transparent pointer-events-none z-10" />
      </div>

      {/* ✅ Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-black/90 border-t border-white/10 backdrop-blur-xl z-20">
        <div className="flex justify-around items-center h-16">
          {[
            { id: "scan", icon: <Home /> },
            { id: "charts", icon: <TrendingUp /> },
            { id: "library", icon: <Library /> },
          ].map((b) => (
            <button
              key={b.id}
              onClick={() => setTab(b.id)}
              className={`flex flex-col items-center text-xs transition-all duration-200 ${
                tab === b.id
                  ? "text-[#6bffcb] scale-105"
                  : "text-gray-400 hover:text-[#6bffcb]/70"
              }`}
            >
              <div className="w-6 h-6 mb-1">{b.icon}</div>
              {b.id.toUpperCase()}
              {tab === b.id && (
                <div className="mt-1 w-6 h-[2px] bg-[#6bffcb] rounded-full shadow-[0_0_8px_#6bffcb]" />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}


/* ✅ SCAN TAB */
const ScanTab = ({ result, setResult, history, setHistory }) => {
  const [status, setStatus] = useState("idle");
  const [count, setCount] = useState(7);
  const [error, setError] = useState(null);
  const [audioData, setAudioData] = useState([]);

  const audioCtx = useRef(null);
  const analyser = useRef(null);
  const stream = useRef(null);
  const recorder = useRef(null);
  const chunks = useRef([]);
  const raf = useRef(null);
  const timer = useRef(null);

  const BACKEND = "http://localhost:8000";

  const start = async () => {
    try {
      setError(null);
      setStatus("listening");
      setCount(7);

      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = mic;

      const ctx = new AudioContext();
      audioCtx.current = ctx;

      const src = ctx.createMediaStreamSource(mic);
      analyser.current = ctx.createAnalyser();
      analyser.current.fftSize = 128;
      src.connect(analyser.current);

      const rec = new MediaRecorder(mic);
      recorder.current = rec;
      chunks.current = [];

      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => send(new Blob(chunks.current, { type: "audio/webm" }));
      rec.start();

      let secs = 7;
      timer.current = setInterval(() => {
        secs--;
        setCount(secs);
        if (secs <= 0) stop();
      }, 1000);

      draw();
    } catch {
      setError("Mic access denied");
      setStatus("error");
    }
  };

  const stop = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    audioCtx.current?.close();
    cancelAnimationFrame(raf.current);
    clearInterval(timer.current);
    setStatus("processing");
  };

  const send = async (blob) => {
    try {
      const form = new FormData();
      form.append("audio", blob, "clip.webm");

      const r = await fetch(`${BACKEND}/recognize`, { method: "POST", body: form });
      const data = await r.json();
      if (!data.success) throw Error();

      const match = {
        id: Date.now(),
        title: data.title,
        artist: data.artist,
        album: data.album,
        cover: data.cover,
        preview: data.preview,
        release: data.release,
        spotify_url: data.spotify_url,
        popularity: data.popularity,
        confidence: data.confidence,
        time: "just now",
      };

      setResult(match);
      setHistory((p) => [match, ...p]);
      setStatus("found");
    } catch {
      setError("No match or server offline");
      setStatus("error");
      cancel();
    }
  };

  const cancel = () => {
    stop();
    setStatus("idle");
    setCount(7);
    setAudioData([]);
  };

  const draw = () => {
    const arr = new Uint8Array(analyser.current.frequencyBinCount);
    analyser.current.getByteFrequencyData(arr);
    setAudioData([...arr]);
    raf.current = requestAnimationFrame(draw);
  };

  if (result && status === "found") {
    return <ResultScreen result={result} onClose={() => { setResult(null); setStatus("idle"); }} />;
  }

  return (
    <div className="relative flex flex-col justify-center items-center h-full pt-20 sm:pt-28 md:pt-32">
      {/* Orb */}
      <button
        onClick={status === "idle" ? start : status === "listening" ? cancel : null}
        className={`relative w-72 h-72 rounded-full bg-white/10 border border-[#6bffcb]/40
        flex items-center justify-center backdrop-blur-xl 
        transition-all duration-300 shadow-[0_0_40px_rgba(107,255,203,0.4)]
        ${status === "listening" ? "scale-110" : "hover:scale-105"}`}
      >
        <SoundOrbIcon active={status === "listening"} />

        {status === "listening" && (
          <span className="absolute bottom-8 text-lg font-medium text-[#6bffcb]/90">
            Listening… {count}s
          </span>
        )}

        {status === "processing" && <span className="text-white/80 animate-pulse">Processing…</span>}
        {status === "error" && <AlertCircle className="text-red-500 w-20 h-20" />}
      </button>

      {/* Wave ring */}
      {status === "listening" && audioData.length > 0 && (
        <div className="absolute">
          {audioData.slice(0, 28).map((val, i) => {
            const a = (i / 28) * Math.PI * 2;
            const r = 120 + (val / 255) * 30;
            return (
              <div
                key={i}
                className="absolute w-1 bg-[#6bffcb] rounded-full"
                style={{
                  height: 6 + (val / 255) * 18,
                  left: "50%",
                  top: "50%",
                  transform: `translate(-50%,-50%) translate(${Math.cos(a) * r}px, ${Math.sin(a) * r}px)`,
                  opacity: 0.4 + (val / 255) * 0.6,
                }}
              />
            );
          })}
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
    </div>
  );
};


const ResultScreen = ({ result, onClose }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [dominant, setDominant] = useState([107, 255, 203]); // fallback SONAR green

  useEffect(() => {
    if (result.cover) {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = result.cover;
      img.onload = () => {
        try {
          const colorThief = new ColorThief();
          const rgb = colorThief.getColor(img);
          setDominant(rgb);
        } catch (e) {
          console.warn("Color extraction failed:", e);
        }
      };
    }
  }, [result.cover]);

  const togglePreview = () => {
    if (!result.preview) return;
    const audio = audioRef.current;
    if (audio.paused) {
      audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const bg = `linear-gradient(180deg, rgba(${dominant.join(",")},0.4) 0%, #0a0d13 90%)`;
  const glow = `rgba(${dominant.join(",")},0.5)`;

  return (
    <div
      className="relative h-screen w-full text-white overflow-hidden transition-colors duration-700"
      style={{ background: bg }}
    >
      {/* Faint blurred cover as texture */}
      {result.cover && (
        <img
          src={result.cover}
          alt={result.title}
          className="absolute inset-0 w-full h-full object-cover opacity-25 blur-3xl"
        />
      )}

      <div className="absolute inset-0 bg-black/60" />

      <div className="relative flex flex-col items-center justify-center text-center p-6 z-10 h-full">
        {/* Header */}
        <button
          onClick={onClose}
          className="absolute top-6 left-6 text-[#6bffcb] hover:text-white font-medium transition"
        >
          ← Back
        </button>

        {/* Album Art */}
        <div
          className="w-56 h-56 rounded-2xl overflow-hidden shadow-2xl transition-all"
          style={{
            boxShadow: `0 0 60px ${glow}`,
          }}
        >
          <img
            src={result.cover || "https://via.placeholder.com/256"}
            alt={result.title}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Title / Artist */}
        <h1 className="text-3xl font-bold mt-6 leading-tight drop-shadow-[0_0_10px_rgba(0,0,0,0.4)]">
          {result.title}
        </h1>
        <p className="text-lg text-gray-200 font-medium mt-1 tracking-wide">
          {result.artist}
        </p>

        {/* Album / Release */}
        <div className="mt-3 space-y-1 text-gray-300 text-sm font-medium">
          {result.album && (
            <p>
              Album:{" "}
              <span className="text-white font-semibold">{result.album}</span>
            </p>
          )}
          {result.release && (
            <p>
              Released:{" "}
              <span className="text-white font-semibold">{result.release}</span>
            </p>
          )}
        </div>

        {/* Popularity bar */}
        {result.popularity !== undefined && (
          <div className="mt-8 w-3/4 max-w-lg">
            <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">
              Spotify Popularity
            </p>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-700"
                style={{
                  width: `${result.popularity}%`,
                  background: `linear-gradient(90deg, rgba(${dominant.join(",")},0.9), #ffd47a)`,
                }}
              />
            </div>
            <p className="mt-1 text-sm text-gray-400">{result.popularity}/100</p>
          </div>
        )}

        {/* Buttons */}
        <div className="mt-10 flex flex-col gap-4 w-full max-w-xs">
          {result.preview && (
            <>
              <button
                onClick={togglePreview}
                className={`w-full py-3 rounded-xl font-semibold transition-all ${
                  isPlaying
                    ? "text-black"
                    : "text-white border border-white/30 hover:bg-white/10"
                }`}
                style={{
                  backgroundColor: isPlaying ? `rgb(${dominant.join(",")})` : "transparent",
                }}
              >
                {isPlaying ? "⏸ Pause Preview" : "🎧 Hear Preview"}
              </button>
              <audio ref={audioRef} src={result.preview} onEnded={() => setIsPlaying(false)} />
            </>
          )}

          {result.spotify_url && (
            <a
              href={result.spotify_url}
              target="_blank"
              rel="noreferrer"
              className="w-full text-center py-3 font-semibold rounded-xl hover:scale-[1.02] transition-transform shadow-[0_0_20px_rgba(0,0,0,0.3)]"
              style={{
                // brighten background by 30%
                backgroundColor: `rgb(${dominant.map(c => Math.min(c * 1.3, 255)).join(",")})`,
                // choose text color dynamically based on perceived brightness
                color:
                  (0.299 * dominant[0] + 0.587 * dominant[1] + 0.114 * dominant[2]) > 160
                    ? "#111"
                    : "#f1f1f1",
              }}
            >
              Open in Spotify
          </a>

          )}
        </div>
      </div>
    </div>
  );
};





/* ✅ Library Tab Working */
const LibraryTab = ({ history }) => (
  <div className="p-6">
    <h2 className="text-xl font-semibold mb-6 text-[#6bffcb]">History</h2>

    {history.length === 0 && (
      <p className="text-gray-500 text-center mt-20">No songs identified yet.</p>
    )}

    {history.map(item => (
      <div key={item.id} className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
        <div>
          <p className="font-semibold">{item.title}</p>
          <p className="text-sm text-gray-400">{item.artist}</p>
        </div>
        <span className="text-xs text-[#6bffcb]">{Math.round(item.confidence * 100)}%</span>
      </div>
    ))}
  </div>
);

/* ✅ Charts Tab Mock Data */
const ChartsTab = () => {
  const fake = [
    { title: "Blinding Lights", artist: "The Weeknd" },
    { title: "Heat Waves", artist: "Glass Animals" },
    { title: "Levitating", artist: "Dua Lipa" },
    { title: "Save Your Tears", artist: "The Weeknd" },
  ];

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-6 text-[#6bffcb]">Top Tracks</h2>

      {fake.map((song,i)=>(
        <div key={i} className="p-3 border-b border-white/10 flex justify-between">
          <div>
            <p className="font-medium">{song.title}</p>
            <p className="text-xs text-gray-400">{song.artist}</p>
          </div>
          <span className="text-gray-600">{i+1}</span>
        </div>
      ))}
    </div>
  );
};