"use client";

/**
 * Kartu sumber yang bisa dibuka.
 *
 * Tiburon menjanjikan "menjawab dari korpusmu dan menyebut sumbernya". Sampai
 * sekarang itu masih berupa nama berkas — sebuah klaim. Kartu ini membuatnya
 * BISA DIPERIKSA: klik, dan potongan korpus yang sesungguhnya terbuka, dengan
 * kata-kata yang cocok disorot.
 *
 * Itu bukan hiasan. Seluruh proyek ini berdiri di atas ketidakpercayaan pada
 * jawaban yang tidak bisa diverifikasi — model yang mengarang laporan status,
 * penyedia yang membalas teks tagihan sebagai jawaban. Kartu ini menutup celah
 * yang sama pada Tiburon sendiri.
 *
 * Gerak: membuka/menutup dianggap "occasional" — dipakai saat pengguna
 * benar-benar ingin memeriksa, bukan puluhan kali sehari. Tingginya
 * dianimasikan lewat grid-template-rows, satu-satunya cara memuai dari tinggi
 * nol tanpa mengetahui tinggi isinya lebih dulu.
 */

import { useState } from "react";
import { IkonBerkas, IkonLipat, IkonPeringatan } from "@/components/Ikon";

type Potongan = { berkas: string; jalur: string; teks: string; skor: number };

function sorot(teks: string, kata: string[]) {
  if (kata.length === 0) return teks;
  const pola = new RegExp(`(${kata.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return teks.split(pola).map((bagian, i) =>
    pola.test(bagian) && kata.some((k) => k.toLowerCase() === bagian.toLowerCase()) ? (
      <mark
        key={i}
        style={{ background: "transparent", color: "var(--surface)", fontWeight: 600 }}
      >
        {bagian}
      </mark>
    ) : (
      <span key={i}>{bagian}</span>
    ),
  );
}

export function KartuSumber({ berkas, kueri }: { berkas: string; kueri: string }) {
  const [buka, setBuka] = useState(false);
  const [potongan, setPotongan] = useState<Potongan[] | null>(null);
  const [pesan, setPesan] = useState("");
  const [memuat, setMemuat] = useState(false);

  const kata = kueri
    .split(/\s+/)
    .map((k) => k.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((k) => k.length > 3);

  async function alih() {
    const berikut = !buka;
    setBuka(berikut);
    if (!berikut || potongan) return;

    setMemuat(true);
    try {
      const r = await fetch(
        `/api/korpus/cari?q=${encodeURIComponent(kueri)}&berkas=${encodeURIComponent(berkas)}`,
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (d.pesan) setPesan(d.pesan);
      setPotongan(d.potongan ?? []);
    } catch (e) {
      // Gagal memuat isi sumber TIDAK boleh terlihat sama dengan sumber kosong.
      setPesan(`Isi sumber gagal dimuat: ${(e as Error).message}`);
      setPotongan([]);
    } finally {
      setMemuat(false);
    }
  }

  return (
    <div className="naik">
      <button
        onClick={() => void alih()}
        aria-expanded={buka}
        className="rounded-[var(--radius-kecil)] px-2 py-0.5 text-[11px] transition"
        style={{
          background: "var(--hover)",
          color: "var(--surface)",
          boxShadow: buka ? "var(--pendar-kuat)" : "var(--pendar)",
        }}
      >
        <span className="flex items-center gap-1.5">
          <IkonBerkas ukuran={12} />
          {berkas}
          {/* Satu panah yang BERPUTAR 90°, bukan dua bentuk yang bertukar.
              Bentuk yang bertukar terbaca sebagai kedipan; bentuk yang
              berputar terbaca sebagai sesuatu yang terbuka. */}
          <IkonLipat
            ukuran={11}
            buka={buka}
            className={buka ? "ikon-lipat-buka" : undefined}
          />
        </span>
      </button>

      {/* grid-template-rows 0fr → 1fr: satu-satunya cara memuai dari tinggi nol
          tanpa tahu tinggi isinya lebih dulu, dan tetap bisa dianimasikan. */}
      <div
        className="grid"
        style={{
          gridTemplateRows: buka ? "1fr" : "0fr",
          transition: "grid-template-rows 200ms var(--keluar)",
        }}
      >
        <div className="overflow-hidden">
          <div
            className="mt-2 rounded-[var(--radius)] border p-3 text-[12px] leading-[1.7]"
            style={{ borderColor: "var(--garis)", background: "var(--abyss)" }}
          >
            {memuat && <span style={{ color: "var(--redup)" }}>Membaca korpus…</span>}

            {pesan && (
              <p role="alert" style={{ color: "var(--warn)" }}>
                <IkonPeringatan ukuran={12} className="mr-1 inline-block align-[-2px]" />
                {pesan}
              </p>
            )}

            {potongan?.length === 0 && !memuat && !pesan && (
              <p style={{ color: "var(--redup)" }}>
                Potongan tidak ditemukan lagi — korpus mungkin baru diindeks ulang.
              </p>
            )}

            {potongan?.map((p, i) => (
              <div key={i} className={i > 0 ? "mt-3 border-t pt-3" : ""} style={{ borderColor: "var(--garis)" }}>
                <p className="whitespace-pre-wrap" style={{ color: "var(--shell)" }}>
                  {sorot(p.teks, kata)}
                </p>
                <p className="angka mt-1 text-[10px]" style={{ color: "var(--redup)" }}>
                  {p.jalur}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
