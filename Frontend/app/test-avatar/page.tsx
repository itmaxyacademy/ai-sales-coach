"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

const AIAvatar3D = dynamic(
  () => import("../../components/Aiavatar3d").then((m) => m.AIAvatar3D),
  { ssr: false }
);

export default function TestAvatarPage() {
  const [state, setState] = useState<"idle" | "speaking" | "listening" | "thinking">("idle");

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col items-center justify-center font-sans">
      <div className="w-full max-w-4xl mb-5">
        <Link href="/manager/dashboard" className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Dashboard
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-2">Showcase 3D Avatar (AI Sales Coach)</h1>
      <p className="text-slate-400 text-sm mb-6">Perbandingan Avatar Cowok (M1) vs Avatar Cewek (F1)</p>

      <div className="flex gap-4 mb-8">
        {(["idle", "speaking", "listening", "thinking"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setState(s)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all ${
              state === s ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        {/* Avatar Cowok */}
        <div className="flex flex-col items-center bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-2xl">
          <div className="w-72 h-80 rounded-2xl overflow-hidden border-2 border-blue-500/30 relative bg-[#1c5f7b]">
            <AIAvatar3D gender="M" state={state} mood="neutral" />
          </div>
          <div className="mt-4 text-center">
            <h2 className="text-lg font-bold text-white flex items-center justify-center gap-2">
              👨 Avatar Cowok (M)
            </h2>
            <p className="text-xs text-blue-400 font-mono mt-1">Model: /3d/m1.vrm</p>
            <p className="text-xs text-slate-400 mt-1">Suara: Ardi (Indo) / Guy (Inggris)</p>
          </div>
        </div>

        {/* Avatar Cewek */}
        <div className="flex flex-col items-center bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-2xl">
          <div className="w-72 h-80 rounded-2xl overflow-hidden border-2 border-pink-500/30 relative bg-[#1c5f7b]">
            <AIAvatar3D gender="F" state={state} mood="neutral" />
          </div>
          <div className="mt-4 text-center">
            <h2 className="text-lg font-bold text-white flex items-center justify-center gap-2">
              👩 Avatar Cewek (F)
            </h2>
            <p className="text-xs text-pink-400 font-mono mt-1">Model: /3d/f1.vrm</p>
            <p className="text-xs text-slate-400 mt-1">Suara: Gadis (Indo) / Jenny (Inggris)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
