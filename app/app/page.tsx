"use client";

import { useState } from "react";
import { PemilihJalur, LATAR_JALUR, type Jalur } from "@/components/chat/PemilihJalur";

type Balasan = { peran: "user" | "assistant"; isi: string; model?: string; sumber?: string[]; peringatan?: string };

export default function HalamanObrolan() {
  const [jalur, setJalur] = useState<Jalur>("cepat");
  const [pesan, setPesan] = useState<Balasan[]>([]);
  const [teks, setTeks] = useState("");
  const [sibuk, setSibuk] = useState(false);

  async function kirim() {
    if (!teks.trim() || sibuk) return;
    const riwayat = [...pesan, { peran: "user" as const, isi: teks }];
    setPesan([...riwayat, { peran: "assistant", isi: "" }]);
    setTeks("");
    setSibuk(true);

    const resp = await fetch("/api/cepat", {
      method: "POST",
      body: JSON.stringify({
        jalur,
        pesan: riwayat.map((p) => ({ role: p.peran, content: p.isi })),
      }),
    });

    const pembaca = resp.body!.getReader();
    const dekoder = new TextDecoder();
    let sisa = "";
    while (true) {
      const { done, value } = await pembaca.read();
      if (done) break;
      sisa += dekoder.decode(value, { stream: true });
      const baris = sisa.split("\n");
      sisa = baris.pop() ?? "";
      for (const b of baris) {
        if (!b.startsWith("data: ")) continue;
        const k = JSON.parse(b.slice(6));
        setPesan((lama) => {
          const salin = [...lama];
          const akhir = salin[salin.length - 1];
          if (k.jenis === "teks") akhir.isi += k.teks;
          if (k.jenis === "model") akhir.model = k.nama;
          if (k.jenis === "sumber") akhir.sumber = k.berkas;
          if (k.jenis === "peringatan") akhir.peringatan = k.pesan;
          if (k.jenis === "gagal") akhir.isi = `⚠️ ${k.pesan}`;
          return salin;
        });
      }
    }
    setSibuk(false);
  }

  return (
    <div
      className="flex h-screen flex-col transition-colors duration-[400ms]"
      style={{ background: LATAR_JALUR[jalur] }}
    >
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {pesan.map((p, i) => (
          <div key={i} className="max-w-3xl">
            <div className="mb-1 text-xs opacity-60">{p.peran === "user" ? "Kamu" : "🦈 Tiburon"}</div>
            {p.peringatan && (
              <div className="mb-2 rounded border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs">
                ⚠️ {p.peringatan}
              </div>
            )}
            {(p.model || p.sumber?.length) && (
              <div className="mb-2 flex gap-2 text-xs opacity-70">
                {p.model && <span className="rounded bg-white/10 px-2 py-0.5">↪ {p.model}</span>}
                {p.sumber?.length ? (
                  <span className="rounded bg-white/10 px-2 py-0.5">📄 {p.sumber.length} sumber</span>
                ) : null}
              </div>
            )}
            <div className="whitespace-pre-wrap">{p.isi || (sibuk && i === pesan.length - 1 ? "…" : "")}</div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 p-4">
        <PemilihJalur jalur={jalur} onGanti={setJalur} />
        <div className="mt-2 flex gap-2">
          <input
            value={teks}
            onChange={(e) => setTeks(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && kirim()}
            placeholder="Tanya apa saja…"
            className="flex-1 rounded-lg bg-white/10 px-3 py-2 outline-none"
          />
          <button onClick={kirim} disabled={sibuk} className="rounded-lg bg-white/15 px-4 disabled:opacity-40">
            →
          </button>
        </div>
      </div>
    </div>
  );
}
