"use client";

import { useState } from "react";
import { PemilihJalur, LATAR_JALUR, type Jalur } from "@/components/chat/PemilihJalur";

type Balasan = { peran: "user" | "assistant"; isi: string; model?: string; sumber?: string[]; peringatan?: string };

type KejadianAliran =
  | { jenis: "model"; nama: string }
  | { jenis: "teks"; teks: string }
  | { jenis: "sumber"; berkas: string[] }
  | { jenis: "peringatan"; pesan: string }
  | { jenis: "gagal"; pesan: string }
  | { jenis: "selesai" };

/** Baris `data:` yang cacat dilewati — satu baris rusak tidak boleh menjatuhkan seluruh jawaban yang sedang mengalir. */
function bacaKejadian(baris: string): KejadianAliran | null {
  try {
    const k: unknown = JSON.parse(baris);
    if (typeof k === "object" && k !== null && "jenis" in k) {
      return k as KejadianAliran;
    }
  } catch {
    // diabaikan — lihat komentar di atas
  }
  return null;
}

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

    try {
      const resp = await fetch("/api/cepat", {
        method: "POST",
        body: JSON.stringify({
          jalur,
          pesan: riwayat.map((p) => ({ role: p.peran, content: p.isi })),
        }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error(`Server membalas ${resp.status}${resp.body ? "" : " tanpa isi"}`);
      }

      const pembaca = resp.body.getReader();
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
          const k = bacaKejadian(b.slice(6));
          if (!k) continue;
          setPesan((lama) => {
            const salin = [...lama];
            const akhir = salin[salin.length - 1];
            if (k.jenis === "teks") akhir.isi += k.teks;
            if (k.jenis === "model") akhir.model = k.nama;
            if (k.jenis === "sumber") akhir.sumber = k.berkas;
            if (k.jenis === "peringatan") akhir.peringatan = k.pesan;
            if (k.jenis === "gagal") {
              akhir.isi = akhir.isi ? `${akhir.isi}\n\n⚠️ ${k.pesan}` : `⚠️ ${k.pesan}`;
            }
            return salin;
          });
        }
      }
    } catch (e) {
      // Tanpa blok ini, kegagalan jaringan (fetch melempar) mengunci layar
      // tanpa pesan apa pun: sibuk macet true, input terkunci selamanya.
      setPesan((lama) => {
        const salin = [...lama];
        const akhir = salin[salin.length - 1];
        akhir.isi = akhir.isi
          ? `${akhir.isi}\n\n⚠️ Terputus: ${(e as Error).message}`
          : `⚠️ Gagal menghubungi server: ${(e as Error).message}`;
        return salin;
      });
    } finally {
      // WAJIB di finally, bukan di akhir try — kegagalan apa pun sebelum ini
      // tidak boleh meninggalkan input terkunci selamanya.
      setSibuk(false);
    }
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
