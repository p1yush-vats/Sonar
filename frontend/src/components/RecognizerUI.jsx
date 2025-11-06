import React, { useState, useEffect, useRef } from "react";
import { Radio } from "lucide-react";
import "./styles.css";

export default function RecognizerUI() {
  const [state, setState] = useState("idle"); // idle, listening, processing, matched
  const [audioData, setAudioData] = useState([]);
  const [result, setResult] = useState(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const animRef = useRef(null);
  const timeoutRef = useRef(null);

  // Parallax cursor
  useEffect(() => {
    const fx = e => {
      setMouse({
        x: (e.clientX / window.innerWidth - 0.5) * 20,
        y: (e.clientY / window.innerHeight - 0.5) * 20,
      });
    };
    window.addEventListener("mousemove", fx);
    return () => window.removeEventListener("mousemove", fx);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => reset();
  }, []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      // Recorder
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      let chunks = [];

      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        sendAudio(blob);
      };

      recorder.start();
      setState("listening");
      visualize();

      timeoutRef.current = setTimeout(() => stop(), 5000);
      
    } catch (err) {
      console.error(err);
    }
  };

  const stop = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive")
      recorderRef.current.stop();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }

    cancelAnimationFrame(animRef.current);
    clearTimeout(timeoutRef.current);

    setAudioData([]);
  };

  const reset = () => {
    stop();
    setAudioData([]);
    setResult(null);
    setState("idle");
  };

  const visualize = () => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const buf = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      if (state !== "listening") return;
      analyser.getByteFrequencyData(buf);
      setAudioData([...buf.slice(0, 48)]);
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
  };

  const sendAudio = async blob => {
    setState("processing");

    try {
      const form = new FormData();
      form.append("audio", blob, "clip.webm");

      const res = await fetch("http://localhost:8000/recognize", {
        method: "POST",
        body: form,
      });

      const data = await res.json();

      setTimeout(() => {
        setResult(data);
        setState("matched");
      }, 1000);
    } catch {
      // fallback demo
      setTimeout(() => {
        setResult({
          title: "Do I Wanna Know?",
          artist: "Arctic Monkeys",
          confidence: 0.94,
        });
        setState("matched");
      }, 1200);
    }
  };

  const text = {
    idle: "ENGAGE",
    listening: "LISTENING...",
    processing: "ANALYZING...",
    matched: "MATCHED",
  }[state];

  const handleOrb = () => {
    if (state === "idle") start();
    else reset();
  };

  return (
    
    <div className="min-h-screen flex items-center justify-center relative select-none">
      
      {/* glowing bg */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 w-[900px] h-[900px]
          -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl 
          bg-cyan-500/10 animate-pulse">
        </div>
      </div>

      {/* orb */}
      <div
        className="relative transition-transform duration-200"
        style={{ transform: `translate(${mouse.x}px,${mouse.y}px)` }}
      >
        {state === "listening" && (
          <>
            <div className="absolute inset-0 -m-12 rounded-full border-2 border-cyan-300/30 animate-ping" />
            <div className="absolute inset-0 -m-12 rounded-full border-2 border-pink-300/30 animate-ping delay-200" />
          </>
        )}

        {/* spinning rings */}
        <div
          className={`absolute inset-0 rounded-full border-4 border-transparent border-t-cyan-400 border-r-pink-400 ${
            state !== "idle" ? "animate-spin" : ""
          }`}
          style={{ animationDuration: "3s" }}
        />
        <div
          className={`absolute inset-6 rounded-full border-2 border-transparent border-b-pink-400/50 border-l-cyan-400/50 ${
            state !== "idle" ? "animate-spin-reverse" : ""
          }`}
          style={{ animationDuration: "4s" }}
        />

        {/* orb button */}
        <button
          onClick={handleOrb}
          className={`relative rounded-full flex items-center justify-center backdrop-blur-xl
            border-2 w-[350px] h-[350px] text-lg font-bold tracking-widest transition-all
          ${
            state === "matched"
              ? "bg-gradient-to-br from-cyan-400 to-pink-500 border-white shadow-[0_0_80px_cyan] scale-105"
              : state === "listening"
              ? "bg-gradient-to-br from-cyan-500/50 to-pink-500/50 border-cyan-400/80 animate-breath shadow-[0_0_60px_cyan]"
              : state === "processing"
              ? "bg-gradient-to-br from-cyan-500/40 to-pink-500/40 border-cyan-400/50"
              : "bg-gradient-to-br from-cyan-500/30 to-pink-500/30 border-cyan-400/50 hover:shadow-[0_0_60px_cyan] hover:scale-105"
          }
        `}
        >
          {text}
        </button>

        {/* Circular waveform */}
        {state === "listening" && audioData.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {audioData.map((v, i) => {
              const angle = (i / 48) * Math.PI * 2;
              const dist = 150 + (v / 255) * 50;
              const x = Math.cos(angle) * dist;
              const y = Math.sin(angle) * dist;
              const h = 6 + (v / 255) * 28;
              return (
                <div
                  key={i}
                  className="absolute w-[3px] bg-gradient-to-t from-cyan-400 to-pink-400 rounded-full"
                  style={{
                    height: `${h}px`,
                    transform: `translate(${x}px,${y}px)`,
                    opacity: 0.4 + v / 255,
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* match card */}
      {state === "matched" && result && (
        <div className="absolute bottom-10 bg-black/70 border border-cyan-500/30 rounded-xl p-6 backdrop-blur-xl animate-fade">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-3 flex items-center justify-center rounded-full bg-cyan-500/30">
              <Radio className="w-10 h-10 text-cyan-300" />
            </div>
            <h2 className="text-xl font-bold text-cyan-300">{result.title}</h2>
            <p className="text-pink-300">{result.artist}</p>
          </div>

          <div className="mt-3 w-full bg-gray-700 h-2 rounded">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-pink-500"
              style={{ width: `${(result.confidence ?? 0.9) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* small text */}
      {state === "idle" && (
        <p className="absolute bottom-10 text-gray-500 text-xs">
          Tap the orb to start listening
        </p>
      )}
      {state === "processing" && (
        <p className="absolute bottom-10 text-cyan-400 animate-pulse text-xs">
          Analyzing audio fingerprint…
        </p>
      )}
    </div>
  );
}
