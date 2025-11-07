import React, { useState, useEffect } from "react";
import { Waves } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";



export default function IntroScreen({ onFinish }) {
  const [statusText, setStatusText] = useState("Initializing SONAR core...");
  const [elapsed, setElapsed] = useState(0);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState(0);
  const [boost, setBoost] = useState(false);
  const [fadeOut, setFadeOut] = useState(false); // 🧠 smooth exit

  const colors = ["#6bffcb", "#ffd47a", "#a0a0ff", "#42f554"];
  const MAX_TIME = 180;

  useEffect(() => {
    const colorTimer = setInterval(() => {
      setPhase((p) => (p + 1) % colors.length);
    }, 3000);
    return () => clearInterval(colorTimer);
  }, []);

  // Timer with boost
  useEffect(() => {
    const tick = setInterval(() => {
      setElapsed((e) => (boost ? Math.min(e + 3, MAX_TIME) : Math.min(e + 1, MAX_TIME)));
    }, 1000);
    return () => clearInterval(tick);
  }, [boost]);

  // Logs
  useEffect(() => {
    const logs = [
      [5, "Checking audio pipeline integrity..."],
      [10, "Loading fingerprint matrix (1.2 GB)..."],
      [20, "Reconstructing spectral graph nodes..."],
      [30, "Aligning frequency peaks..."],
      [40, "Optimizing GPU memory map..."],
      [50, "Resolving hash buckets..."],
      [60, "Sorry, CUDA wanted a coffee break ☕"],
      [70, "Synchronizing temporal offsets..."],
      [90, "Phase calibration almost complete..."],
      [110, "Normalizing gain thresholds..."],
      [130, "Preparing mic input analysis..."],
      [150, "Finalizing spectral constellations..."],
      [170, "Stabilizing DSP kernel..."],
      [175, "Ready signal pending..."],
    ];
    const log = logs.find(([t]) => t === elapsed);
    if (log) setStatusText(log[1]);
  }, [elapsed]);

  // Poll backend
  useEffect(() => {
    let poll;
    const checkBackend = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/ping`);
        const data = await res.json();
        if (data.status === "ready") {
          setStatusText(
            `✅ Fingerprints loaded (${data.songs_loaded} songs on ${data.device}).`
          );
          setBoost(true);
          // Let the progress complete visually first
          setTimeout(() => {
            setFadeOut(true); // start fade to black
            setTimeout(() => {
              setReady(true);
              onFinish(); // after fade is complete
            }, 2000);
          }, 4000);
        } else {
          poll = setTimeout(checkBackend, 4000);
        }
      } catch {
        poll = setTimeout(checkBackend, 4000);
      }
    };
    checkBackend();
    return () => clearTimeout(poll);
  }, [onFinish]);

  const progress = Math.min((elapsed / MAX_TIME) * 100, 100);
  const currentColor = colors[phase];
  const nextColor = colors[(phase + 1) % colors.length];

  return (
    <AnimatePresence>
      {!ready && (
        <motion.div
          className="fixed inset-0 flex flex-col items-center justify-center bg-[#0b0f15] text-white overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: fadeOut ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: fadeOut ? 2 : 1 }}
        >
          {/* Dynamic glow background */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 50% 40%, ${currentColor}33, transparent 70%)`,
              transition: "background 2s ease",
            }}
          />

          {/* SONAR Title */}
          <motion.h1
            className="text-5xl font-extrabold tracking-[0.25em] mb-10 z-10"
            animate={{ color: currentColor, textShadow: `0 0 25px ${currentColor}` }}
            transition={{ duration: 2 }}
          >
            SONAR
          </motion.h1>

          {/* Animated Orb */}
          <motion.div
            animate={{
              scale: [1, 1.15, 1],
              boxShadow: [
                `0 0 40px ${currentColor}`,
                `0 0 80px ${nextColor}`,
                `0 0 40px ${currentColor}`,
              ],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="w-40 h-40 rounded-full bg-white/5 flex items-center justify-center relative z-10"
            style={{
              border: `2px solid ${currentColor}`,
              backdropFilter: "blur(8px)",
            }}
          >
            <Waves
              className="w-16 h-16"
              style={{
                color: currentColor,
                filter: `drop-shadow(0 0 15px ${currentColor})`,
              }}
            />
          </motion.div>

          {/* Status line */}
          <motion.p
            className="text-gray-300 mt-10 text-lg font-medium z-10 text-center px-8"
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {statusText}
          </motion.p>

          {/* Progress bar */}
          <div className="mt-8 w-3/4 max-w-md h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full"
              animate={{ width: `${progress}%`, backgroundColor: currentColor }}
              transition={{ duration: 1, ease: "easeInOut" }}
            />
          </div>

          {/* Timer */}
          <p className="mt-3 text-xs text-gray-500 tracking-wide">
            ⏳ {elapsed}s elapsed — Estimated ~180s boot time
          </p>

          {/* Footer */}
          <motion.p
            className="absolute bottom-8 text-xs text-gray-500 tracking-widest"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            ⚙️ Preparing DSP engine & microphone access
          </motion.p>

          {/* Fade overlay for cinematic exit */}
          {fadeOut && (
            <motion.div
              className="absolute inset-0 bg-black"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 2 }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
