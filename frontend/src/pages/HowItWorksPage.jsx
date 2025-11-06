import { Volume2, Waves, Radio, Zap } from "lucide-react";

export default function HowItWorksPage() {
  const steps = [
    { icon: <Volume2 />, title: "Listen", desc: "Capture ambient sound." },
    { icon: <Waves />, title: "Fingerprint", desc: "Turn waveforms into hashes." },
    { icon: <Radio />, title: "Match", desc: "Compare with database." },
    { icon: <Zap />, title: "Identify", desc: "Return the song!" }
  ];

  return (
    <div className="min-h-screen px-6 py-24 flex justify-center">
      <div className="grid lg:grid-cols-4 gap-8 text-center max-w-5xl">
        {steps.map((s, i) => (
          <div key={i} className="p-6 rounded-xl bg-black/40 border border-cyan-500/30">
            <div className="text-cyan-400 text-4xl">{s.icon}</div>
            <h3 className="mt-4 text-xl font-bold text-cyan-200">{s.title}</h3>
            <p className="text-gray-400 text-sm mt-2">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
