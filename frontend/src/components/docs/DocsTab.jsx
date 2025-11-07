    // src/components/docs/DocsTab.jsx
import React, { useRef, useState, useEffect } from "react";
import { Database, Cpu, Zap, Mic, Server, Globe, Book, Github, Clock } from "lucide-react";

const AnimatedSection = ({ title, icon: Icon, code, children }) => {
  const ref = useRef();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setVisible(true)),
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className={`mb-16 transition-all duration-700 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
    >
      <h2 className="flex items-center gap-2 text-2xl font-semibold mb-3 text-[#6bffcb]">
        <Icon className="w-5 h-5" /> {title}
      </h2>
      <div className="text-gray-300 text-[15px] leading-relaxed">{children}</div>
      {code && (
        <pre className="bg-[#0b1016] text-[#b5f5dd] text-sm p-3 rounded-md mt-4 overflow-x-auto">
          <code>{code}</code>
        </pre>
      )}
    </section>
  );
};

export default function DocsTab() {
  return (
    <div className="p-8 max-w-4xl mx-auto bg-gradient-to-b from-[#0d0f14] to-[#111923] text-white overflow-y-auto">
      <h1 className="text-3xl font-bold mb-10 text-center text-[#6bffcb] tracking-wider drop-shadow-[0_0_10px_#6bffcb]">
        SONAR — Technical Documentation
      </h1>

      {/* 1. Overview */}
      <AnimatedSection title="1 — System Overview" icon={Book}>
        <p>
          SONAR identifies audio by matching its spectral fingerprints to a pre-indexed database.
          The system architecture follows a modular design:
        </p>
        <ul className="list-disc ml-6 my-2 space-y-1">
          <li><b>Frontend</b> captures microphone input and sends a 7-second clip to the backend.</li>
          <li><b>FastAPI Backend</b> converts the clip to WAV, generates fingerprints, and performs matching.</li>
          <li><b>Recognition Engine</b> executes spectrogram, peak extraction, and hash comparison.</li>
          <li><b>Cache Layer</b> loads the prebuilt inverted index for instant hash lookups.</li>
        </ul>
      </AnimatedSection>

      {/* 2. Spectrogram */}
      <AnimatedSection
        title="2 — Spectrogram Computation"
        icon={Cpu}
        code={`SR = 22050
N_FFT = 2048
HOP = 512

spec = torchaudio.transforms.Spectrogram(n_fft=N_FFT, hop_length=HOP)(wav)
S_db = AmplitudeToDB()(torch.abs(spec))`}
      >
        <p>
          Input audio is resampled to a fixed sample rate (22.05 kHz) for uniform frequency scaling.
          A Short-Time Fourier Transform (STFT) converts the waveform into a time–frequency matrix.
          The amplitude is then converted to decibels, enabling thresholding independent of loudness.
        </p>
        <p>
          The resulting matrix <code>S_db</code> represents energy intensity (in dB) across frequency bins and time frames.
          It serves as the basis for peak detection.
        </p>
      </AnimatedSection>

      {/* 3. Peak Detection */}
      <AnimatedSection
        title="3 — Spectral Peak Detection"
        icon={Database}
        code={`local_max = maximum_filter(S_db, size=(20, 20)) == S_db
mask = S_db > -40
peaks = np.argwhere(local_max & mask)  # (freq_idx, time_idx)`}
      >
        <p>
          Peak detection locates high-energy spectral components that remain stable under noise and distortion.
          SONAR applies a morphological <b>maximum filter</b> within a fixed neighborhood window (20×20 bins).
          Only points that equal their local maximum and exceed a defined dB threshold (e.g. −40 dB) are retained.
        </p>
        <p>
          The result is a sparse set of (<i>frequency_index</i>, <i>time_index</i>) coordinates,
          each representing a robust spectral landmark.
        </p>
      </AnimatedSection>

      {/* 4. Hashing */}
      <AnimatedSection
        title="4 — Hash Generation"
        icon={Zap}
        code={`for i, (f1, t1) in enumerate(peaks):
  for (f2, t2) in peaks[i+1:i+5]:
      dt = t2 - t1
      if 0 < dt < 200:
          h = sha1(f"{f1}|{f2}|{dt}")[:20]
          fingerprints.append((h, t1))`}
      >
        <p>
          Fingerprints are built by pairing each anchor peak with nearby peaks in a small time window.
          Each pair encodes two frequencies (<i>f₁,f₂</i>) and a time delta (Δt).
          The triple (<i>f₁,f₂,Δt</i>) is hashed using SHA-1 → 20-character key.
        </p>
        <p>
          These hashes capture local spectral relationships that remain consistent even when pitch or tempo slightly vary.
        </p>
      </AnimatedSection>

      {/* 5. Index */}
      <AnimatedSection
        title="5 — Inverted Index Structure"
        icon={Database}
        code={`# hash -> list of [song_id, time_sec]
inv[h] = np.array(entries, dtype=np.float32)

# cache persistence
pickle.dump({"inv": inv, "meta_by_id": meta}, f, protocol=5)`}
      >
        <p>
          The inverted index maps each hash to its occurrences across all songs:
          <code>{`{hash → [(song_id, time_sec), ...]}`}</code>.
          Storing these lists as compact <code>float32</code> arrays enables memory-efficient vectorized lookup.
        </p>
        <p>
          During startup, the backend loads a binary pickle cache (optionally gzip-compressed) into memory.
          This eliminates JSON parsing and accelerates fingerprint matching.
        </p>
      </AnimatedSection>

      {/* 6. Recognition */}
      <AnimatedSection
        title="6 — Recognition and Voting"
        icon={Mic}
        code={`votes = defaultdict(list)
for h, qt in q_hashes:
    for sid, dbt in inv.get(h, []):
        votes[sid].append(round(dbt - qt, 2))

best_sid = max(votes, key=lambda s: Counter(votes[s]).most_common(1)[0][1])`}
      >
        <p>
          Recognition compares query hashes to the preloaded index.
          Every hash match contributes a vote for (<i>song_id</i>, Δt = time difference).
          The correct match yields a dense cluster of consistent Δt values.
        </p>
        <p>
          Each song’s alignment strength is measured by its modal Δt frequency (alignment count).
          The system selects the candidate with the highest alignment and sufficient match count (<code>MIN_MATCHES</code>).
        </p>
      </AnimatedSection>

      {/* 7. Cache Loading */}
      <AnimatedSection
        title="7 — Cache Loading and Warm-Up"
        icon={Clock}
        code={`with gzip.open("constellation_cache.pkl.gz", "rb") as f:
    obj = pickle.load(f)
inv, meta = obj["inv"], obj["meta_by_id"]`}
      >
        <p>
          Loading the fingerprint cache may take 1–3 minutes, depending on size (~1.2 GB).
          Until complete, <code>/recognize</code> requests are blocked.
          The frontend displays a progress sequence (“loading cache”, “warming GPU”, etc.) until /health returns <code>ready</code>.
        </p>
      </AnimatedSection>

      {/* 8. Spotify Metadata */}
      <AnimatedSection
        title="8 — Spotify Metadata Integration"
        icon={Globe}
        code={`GET /v1/search?q=track:TITLE%20artist:ARTIST&type=track&limit=5`}
      >
        <p>
          Once a match is identified, SONAR queries the Spotify Web API for metadata.
          It uses the Client Credentials flow and caches tokens until expiry.
          Returned fields include album name, cover art URL, release date, preview URL, and popularity index.
        </p>
      </AnimatedSection>

      {/* 9. API Contract */}
      <AnimatedSection
        title="9 — API Contract"
        icon={Server}
        code={`POST /recognize
FormData: { audio: <blob> }

Response:
{
  success: true,
  artist: "...",
  title: "...",
  album: "...",
  cover: "...",
  release: "...",
  popularity: 84,
  confidence: 0.93
}`}
      >
        <p>
          The <code>/recognize</code> endpoint expects an audio blob (WebM/WAV/MP3).  
          It returns structured JSON containing track details and match metrics.
        </p>
      </AnimatedSection>

      {/* 10. Performance */}
      <AnimatedSection title="10 — Performance Considerations" icon={Cpu}>
        <ul className="list-disc ml-6 space-y-1">
          <li>Use preloaded binary pickle cache instead of JSON for fast startup.</li>
          <li>Warm up GPU FFT transforms at server boot to avoid first-call latency.</li>
          <li>Limit ffmpeg invocations or handle conversion asynchronously for scalability.</li>
          <li>Profile cache load and hash matching to monitor CPU/GPU utilization.</li>
        </ul>
      </AnimatedSection>

      {/* 11. Deployment */}
      <AnimatedSection title="11 — Deployment Notes" icon={Server}>
        <p>
          Free-tier hosts often hibernate unused containers, causing cold-start delays.
          Use a periodic keep-alive ping or a persistent backend to maintain cache in memory.
          Implement <code>/health</code> status to signal readiness before frontend activation.
        </p>
      </AnimatedSection>

      {/* Footer */}
      <footer className="mt-12 text-center text-xs text-gray-500 border-t border-white/10 pt-4">
        <p>SONAR v1 — Audio Recognition System</p>
        <p className="flex justify-center items-center gap-2 mt-1">
          <Github className="w-4 h-4" />{" "}
          <a
            href="https://github.com/p1yush-vats/SONAR"
            className="hover:text-[#6bffcb]"
            target="_blank"
            rel="noreferrer"
          >
            View Source on GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}
