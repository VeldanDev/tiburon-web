"use client";

import { useEffect, useState } from "react";
import { KartuRadar } from "@/components/radar/KartuRadar";
import type { LaporanRadar } from "@/lib/radar-parser";

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function HalamanRadar() {
  const [tanggal, setTanggal] = useState(() => iso(new Date()));
  const [laporan, setLaporan] = useState<LaporanRadar | null>(null);
  const [pesan, setPesan] = useState("");
  const [hanyaRelevan, setHanyaRelevan] = useState(false);

  useEffect(() => {
    setLaporan(null);
    setPesan("");
    fetch(`/api/radar?tanggal=${tanggal}`)
      .then(async (r) => (r.ok ? setLaporan(await r.json()) : setPesan((await r.json()).pesan)))
      .catch((e) => setPesan(String(e)));
  }, [tanggal]);

  const geser = (hari: number) => {
    const d = new Date(tanggal);
    d.setDate(d.getDate() + hari);
    setTanggal(iso(d));
  };

  const semua = [...(laporan?.berita ?? []), ...(laporan?.github ?? [])];
  const tampil = hanyaRelevan ? semua.filter((i) => i.relevan) : semua;
  const jumlahRelevan = semua.filter((i) => i.relevan).length;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center gap-3">
        <button onClick={() => geser(-1)} className="rounded px-2 py-1 hover:bg-white/10">◀</button>
        <h1 className="text-lg font-semibold tabular-nums">Radar Pagi · {tanggal}</h1>
        <button onClick={() => geser(1)} className="rounded px-2 py-1 hover:bg-white/10">▶</button>
      </div>

      {laporan && (
        <label className="mb-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hanyaRelevan} onChange={(e) => setHanyaRelevan(e.target.checked)} />
          hanya yang relevan ({jumlahRelevan} dari {semua.length})
        </label>
      )}

      {pesan && <p className="rounded border border-white/20 p-4 text-sm opacity-80">{pesan}</p>}

      <div className="space-y-3">
        {tampil.map((item) => <KartuRadar key={`${item.nomor}-${item.url}`} item={item} />)}
      </div>
    </div>
  );
}
