"use client";

/**
 * Karya — slide konten @veldorable terbaru, tergantung di tali pancing.
 *
 * Bentuknya dari kiriman Vael 23 Okt (portofolio Framer: foto dijepit di tali
 * jemuran), dipindah ke dunia Tiburon: tali pancing dan kail. Yang dijawab
 * halaman ini satu: "konten apa yang barusan dibuat, dan seperti apa
 * tampilannya?" — jadi gambarnya yang besar, bukan metadatanya.
 *
 * Gerak: hanya saat disorot (kartu lurus dan menyala). Tidak ada ayunan
 * berulang; laptop Veldan lemah dan gerak tanpa pemicu cuma jadi derau.
 */

import { useEffect, useState } from "react";
import type { Karya } from "@/lib/karya";
import { IkonPeringatan } from "@/components/Ikon";

// Kemiringan tetap per posisi, bukan acak: acak berubah tiap render dan
// membuat tali terlihat bergetar saat halaman dimuat ulang.
const MIRING = [-3, 2, -1.5, 3, -2.5, 1.5];

export default function HalamanKarya() {
  const [karya, setKarya] = useState<Karya[]>([]);
  const [pesan, setPesan] = useState("");
  const [memuat, setMemuat] = useState(true);

  useEffect(() => {
    let dibatalkan = false;
    fetch("/api/karya")
      .then((r) => r.json())
      .then((d: { karya: Karya[]; pesan?: string }) => {
        if (dibatalkan) return;
        setKarya(d.karya ?? []);
        if (d.pesan) setPesan(d.pesan);
      })
      .catch((e) => {
        if (!dibatalkan) setPesan(`Gagal memuat karya: ${(e as Error).message}`);
      })
      .finally(() => {
        if (!dibatalkan) setMemuat(false);
      });
    return () => {
      dibatalkan = true;
    };
  }, []);

  return (
    <div className="h-screen overflow-y-auto" style={{ background: "var(--latar-tiburon)" }}>
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h1
          className="mb-1 text-[30px] leading-tight"
          style={{ color: "var(--shell)", fontFamily: "var(--font-serif)" }}
        >
          Karya
        </h1>
        <p className="mb-8 text-[13px]" style={{ color: "var(--redup)" }}>
          Slide konten @veldorable terbaru dari pipeline harian. Klik untuk membuka ukuran penuh.
        </p>

        {pesan && (
          <div
            role="alert"
            className="mb-6 rounded-[var(--radius)] border px-4 py-3 text-[13px]"
            style={{ borderColor: "var(--warn)", color: "var(--warn)" }}
          >
            <IkonPeringatan ukuran={13} className="mr-1 inline-block align-[-2px]" />
            {pesan}
          </div>
        )}

        {memuat && (
          <p className="text-[13px]" style={{ color: "var(--redup)" }}>
            Menarik tali…
          </p>
        )}

        {karya.length > 0 && (
          <div className="tali-gulir">
          <div className="tali-pancing" role="list" aria-label="Slide konten terbaru">
            {karya.map((k, i) => (
              <a
                key={`${k.tanggal}/${k.folder}`}
                role="listitem"
                className="karya-gantung"
                href={`/api/karya/gambar?p=${encodeURIComponent(k.gambar)}`}
                target="_blank"
                rel="noopener"
                title={k.judul}
                style={{ "--miring": `${MIRING[i % MIRING.length]}deg` } as React.CSSProperties}
              >
                <span className="karya-kail" aria-hidden />
                {/* eslint-disable-next-line @next/next/no-img-element -- gambar lokal lewat rute API, bukan aset statis */}
                <img src={`/api/karya/gambar?p=${encodeURIComponent(k.gambar)}`} alt={k.judul} loading="lazy" />
                <span className="karya-ket">
                  <span className="angka">{k.tanggal.slice(5)}</span> · {k.judul}
                </span>
              </a>
            ))}
          </div>
          </div>
        )}
      </div>
    </div>
  );
}
