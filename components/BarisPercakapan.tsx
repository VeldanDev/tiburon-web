"use client";

/**
 * Satu baris percakapan di sidebar: buka, ganti nama, hapus.
 *
 * Tiga keputusan yang membentuk komponen ini:
 *
 * 1. Ganti nama terjadi DI TEMPAT, bukan lewat kotak dialog. Judul yang sedang
 *    diperbaiki tetap berada di posisi yang sama, dengan lebar yang sama,
 *    sehingga terlihat langsung apakah judul barunya muat atau akan terpotong
 *    di sidebar. Kotak dialog menyembunyikan justru hal yang sedang dinilai.
 *
 * 2. Menghapus meminta konfirmasi di baris itu sendiri, bukan lewat
 *    `window.confirm`. Yang bawaan itu memblokir seluruh halaman dan tidak
 *    bisa diberi gaya; yang di sini menunjukkan JUDUL apa yang akan hilang,
 *    tepat di tempat barisnya berada.
 *
 * 3. Tombolnya muncul saat hover DAN saat fokus papan ketik. Kalau hanya saat
 *    hover, keduanya tidak bisa dicapai lewat Tab sama sekali.
 */

import { useEffect, useRef, useState } from "react";
import {
  IkonSunting,
  IkonHapus,
  IkonCentang,
  IkonTutup,
  IkonSemat,
} from "@/components/Ikon";

export type Percakapan = {
  id: string;
  judul: string;
  diperbarui: number;
  disemat?: boolean;
};

export function BarisPercakapan({
  percakapan,
  terbaru,
  umur,
  onBuka,
  onGantiNama,
  onHapus,
  onSemat,
}: {
  percakapan: Percakapan;
  terbaru: boolean;
  umur: string;
  onBuka: () => void;
  onGantiNama: (judul: string) => void;
  onHapus: () => void;
  onSemat: (disemat: boolean) => void;
}) {
  const [mode, setMode] = useState<"biasa" | "sunting" | "hapus">("biasa");
  const [draf, setDraf] = useState(percakapan.judul);
  const kotak = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === "sunting") {
      kotak.current?.focus?.();
      kotak.current?.select?.();
    }
  }, [mode]);

  function simpan() {
    const bersih = draf.trim();
    // Judul kosong dibuang, bukan disimpan: baris tanpa judul tidak bisa
    // dikenali lagi di sidebar, dan tidak ada cara memperbaikinya dari sana.
    if (bersih && bersih !== percakapan.judul) onGantiNama(bersih);
    setMode("biasa");
  }

  if (mode === "sunting") {
    return (
      <div className="flex items-center gap-1 px-2 py-1">
        <input
          ref={kotak}
          value={draf}
          onChange={(e) => setDraf(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") simpan();
            if (e.key === "Escape") {
              setDraf(percakapan.judul);
              setMode("biasa");
            }
          }}
          onBlur={simpan}
          aria-label="Judul percakapan"
          className="min-w-0 flex-1 rounded-[var(--radius-kecil)] border px-2 py-1 text-[13px] outline-none"
          style={{
            borderColor: "var(--surface)",
            background: "var(--lapis-0)",
            color: "var(--teks-utama)",
          }}
        />
      </div>
    );
  }

  if (mode === "hapus") {
    return (
      <div
        className="rounded-[var(--radius)] px-3 py-2"
        style={{ background: "var(--lapis-2)" }}
      >
        <p className="mb-1.5 text-[12px]" style={{ color: "var(--teks-utama)" }}>
          Hapus <span style={{ color: "var(--teks-kedua)" }}>{percakapan.judul}</span>?
        </p>
        <div className="flex gap-1.5">
          <button
            onClick={onHapus}
            className="aksi-pesan flex items-center gap-1 rounded-[var(--radius-kecil)] px-2 py-0.5 text-[11px]"
            style={{ color: "var(--danger)" }}
          >
            <IkonCentang ukuran={11} />
            hapus
          </button>
          <button
            onClick={() => setMode("biasa")}
            className="aksi-pesan flex items-center gap-1 rounded-[var(--radius-kecil)] px-2 py-0.5 text-[11px]"
            style={{ color: "var(--redup)" }}
          >
            <IkonTutup ukuran={11} />
            batal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="baris-obrolan group flex w-full items-center gap-2 rounded-[var(--radius)] px-3 py-1.5 text-[13px]"
      style={{ color: "var(--shell)" }}
    >
      {/* Yang disemat memakai ikon jangkar sebagai penandanya, MENGGANTIKAN
          titik. Menaruh keduanya membuat kolom sempit ini punya dua penanda
          berbeda yang bersaing, dan sematan adalah yang lebih penting. */}
      {percakapan.disemat ? (
        <IkonSemat ukuran={11} className="shrink-0" />
      ) : (
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${terbaru ? "titik-hidup" : ""}`}
          style={
            terbaru ? undefined : { background: "transparent", border: "1px solid var(--redup)" }
          }
        />
      )}
      <button
        onClick={onBuka}
        className="min-w-0 flex-1 truncate text-left"
        title={new Date(percakapan.diperbarui).toLocaleString("id-ID")}
      >
        {percakapan.judul}
      </button>

      {/* Umur menghilang saat baris disentuh, digantikan tombolnya. Menaruh
          keduanya sekaligus membuat baris 300px ini terlalu penuh, dan umur
          adalah yang paling tidak dibutuhkan saat tangan sudah di baris itu. */}
      <span
        className="angka aksi-obrolan-sembunyi shrink-0 text-[11px] tabular-nums"
        style={{ color: "var(--redup)" }}
      >
        {umur}
      </span>

      <span className="aksi-obrolan shrink-0 items-center gap-0.5">
        <button
          onClick={() => onSemat(!percakapan.disemat)}
          aria-label={percakapan.disemat ? `Lepas sematan ${percakapan.judul}` : `Sematkan ${percakapan.judul}`}
          className="aksi-pesan rounded-[var(--radius-kecil)] p-1"
          style={{ color: percakapan.disemat ? "var(--surface)" : "var(--redup)" }}
        >
          <IkonSemat ukuran={12} />
        </button>
        <button
          onClick={() => {
            setDraf(percakapan.judul);
            setMode("sunting");
          }}
          aria-label={`Ganti nama ${percakapan.judul}`}
          className="aksi-pesan rounded-[var(--radius-kecil)] p-1"
          style={{ color: "var(--redup)" }}
        >
          <IkonSunting ukuran={12} />
        </button>
        <button
          onClick={() => setMode("hapus")}
          aria-label={`Hapus ${percakapan.judul}`}
          className="aksi-pesan rounded-[var(--radius-kecil)] p-1"
          style={{ color: "var(--redup)" }}
        >
          <IkonHapus ukuran={12} />
        </button>
      </span>
    </div>
  );
}
