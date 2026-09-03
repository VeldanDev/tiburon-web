"use client";

/**
 * Panel artefak — kanvas di sisi kanan.
 *
 * Membuka DI SAMPING, bukan menutupi percakapan. Seluruh gunanya adalah bisa
 * membaca kode sambil melihat kalimat yang menjelaskannya; panel yang menimpa
 * percakapan cuma memindahkan masalah menggulir, tidak menghapusnya.
 *
 * Di layar sempit ia menimpa penuh — di bawah ~900px, dua kolom masing-masing
 * jadi terlalu sempit untuk keduanya, dan yang terjadi bukan "bisa membaca
 * dua-duanya" melainkan "tidak bisa membaca satu pun".
 */

import { useEffect } from "react";
import { BlokKode } from "@/components/chat/BlokKode";
import { unduh } from "@/lib/ekspor";
import { ekstensiUntuk, type Artefak } from "@/lib/artefak";
import { IkonTutup, IkonUnduh } from "@/components/Ikon";

export function PanelArtefak({
  artefak,
  aktif,
  onPilih,
  onTutup,
}: {
  artefak: Artefak[];
  aktif: string;
  onPilih: (id: string) => void;
  onTutup: () => void;
}) {
  const sekarang = artefak.find((a) => a.id === aktif) ?? artefak[0];

  useEffect(() => {
    function esc(e: KeyboardEvent) {
      // Hanya menutup kalau fokus tidak di kotak teks: Escape juga
      // menghentikan jawaban yang mengalir, dan menutup panel di saat yang
      // sama membuat satu tombol melakukan dua hal sekaligus tanpa diminta.
      const el = document.activeElement;
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return;
      if (e.key === "Escape") onTutup();
    }
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onTutup]);

  if (!sekarang) return null;

  return (
    <aside
      className="absolute inset-0 z-30 flex flex-col border-l lg:static lg:inset-auto lg:w-[46%] lg:max-w-[720px]"
      style={{
        borderColor: "var(--garis)",
        backgroundColor: "var(--lapis-1)",
        backgroundImage: "var(--kabut-dalam)",
      }}
      aria-label="Panel artefak"
    >
      <div
        className="flex shrink-0 items-center gap-2 border-b px-4 py-2"
        style={{ borderColor: "var(--garis)" }}
      >
        <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: "var(--teks-utama)" }}>
          {sekarang.judul}
        </span>
        <span className="angka shrink-0 text-[11px]" style={{ color: "var(--teks-redup)" }}>
          {sekarang.baris} baris
        </span>
        <button
          onClick={() =>
            unduh(
              `${sekarang.judul.includes(".") ? sekarang.judul : `${sekarang.judul}.${ekstensiUntuk(sekarang.bahasa)}`}`,
              sekarang.isi,
              "text/plain",
            )
          }
          aria-label="Unduh artefak"
          className="aksi-pesan rounded-[var(--radius-kecil)] p-1.5"
          style={{ color: "var(--redup)" }}
        >
          <IkonUnduh ukuran={14} />
        </button>
        <button
          onClick={onTutup}
          aria-label="Tutup panel artefak"
          className="aksi-pesan rounded-[var(--radius-kecil)] p-1.5"
          style={{ color: "var(--redup)" }}
        >
          <IkonTutup ukuran={14} />
        </button>
      </div>

      {/* Tab hanya muncul kalau memang ada lebih dari satu. Satu tab tunggal
          adalah baris yang tidak pernah bisa diklik untuk apa pun. */}
      {artefak.length > 1 && (
        <div
          className="flex shrink-0 gap-1 overflow-x-auto border-b px-2 py-1.5"
          style={{ borderColor: "var(--garis)" }}
        >
          {artefak.map((a) => (
            <button
              key={a.id}
              onClick={() => onPilih(a.id)}
              className="shrink-0 rounded-[var(--radius-kecil)] px-2.5 py-1 text-[11px] transition"
              style={
                a.id === sekarang.id
                  ? { background: "var(--ocean)", color: "var(--shell)" }
                  : { color: "var(--redup)" }
              }
            >
              {a.judul}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <BlokKode kode={sekarang.isi} bahasa={sekarang.bahasa} />
      </div>
    </aside>
  );
}

/** Chip di bawah jawaban yang membuka panel. */
export function ChipArtefak({
  artefak,
  onBuka,
}: {
  artefak: Artefak[];
  onBuka: (id: string) => void;
}) {
  if (artefak.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {artefak.map((a) => (
        <button
          key={a.id}
          onClick={() => onBuka(a.id)}
          className="naik flex items-center gap-2 rounded-[var(--radius-kecil)] border px-2.5 py-1.5 text-[11px] transition"
          style={{
            borderColor: "var(--garis)",
            background: "var(--lapis-2)",
            color: "var(--teks-kedua)",
          }}
        >
          <span
            aria-hidden
            className="h-3.5 w-[2px] rounded-full"
            style={{ background: "var(--surface)", boxShadow: "var(--pendar)" }}
          />
          {a.judul}
          <span className="angka" style={{ color: "var(--teks-redup)" }}>
            {a.baris} baris
          </span>
        </button>
      ))}
    </div>
  );
}
