"use client";

/**
 * Lampiran di komposer: tombol jangkar, seret-dan-lepas, dan daftar chip.
 *
 * Seret-dan-lepas ada karena itulah cara berkas benar-benar dilampirkan orang
 * saat berkasnya sudah terbuka di layar. Tombolnya tetap ada untuk yang
 * bekerja dengan papan ketik — dan itu sebabnya `<input type="file">` di sini
 * disembunyikan lewat sr-only, bukan display:none: yang kedua membuatnya
 * hilang dari urutan Tab sepenuhnya.
 */

import { useRef, useState } from "react";
import { IkonLampir, IkonTutup, IkonBerkas } from "@/components/Ikon";
import { bacaBerkas, type Lampiran as Berkas } from "@/lib/lampiran";

export function DaftarLampiran({
  lampiran,
  onBuang,
}: {
  lampiran: Berkas[];
  onBuang: (nama: string) => void;
}) {
  if (lampiran.length === 0) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {lampiran.map((l) => (
        <span
          key={l.nama}
          className="naik flex items-center gap-1.5 rounded-[var(--radius-kecil)] px-2 py-1 text-[11px]"
          style={{ background: "var(--lapis-2)", color: "var(--teks-kedua)" }}
        >
          <IkonBerkas ukuran={11} />
          {l.nama}
          {/* Pemotongan disebut di chip-nya sendiri, bukan disembunyikan:
              pengguna harus tahu model tidak membaca seluruh berkasnya. */}
          {l.dipotong && (
            <span style={{ color: "var(--warn)" }} title="Isinya dipotong agar muat">
              dipotong
            </span>
          )}
          <button
            onClick={() => onBuang(l.nama)}
            aria-label={`Buang ${l.nama}`}
            className="aksi-pesan rounded-[2px]"
            style={{ color: "var(--redup)" }}
          >
            <IkonTutup ukuran={10} />
          </button>
        </span>
      ))}
    </div>
  );
}

export function TombolLampir({
  onTambah,
  onGalat,
  nonaktif,
}: {
  onTambah: (b: Berkas[]) => void;
  onGalat: (pesan: string) => void;
  nonaktif?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);

  async function proses(daftar: FileList | null) {
    if (!daftar?.length) return;
    const diterima: Berkas[] = [];
    const ditolak: string[] = [];

    // Satu berkas gagal TIDAK membatalkan sisanya. Menjatuhkan empat berkas
    // yang baik karena satu berkas kelima salah jenis akan memaksa mengulang
    // seluruh pilihan.
    for (const f of Array.from(daftar)) {
      try {
        diterima.push(await bacaBerkas(f));
      } catch (e) {
        ditolak.push((e as Error).message);
      }
    }

    if (diterima.length) onTambah(diterima);
    if (ditolak.length) onGalat(ditolak.join(" "));
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        onChange={(e) => {
          void proses(e.target.files);
          // Direset supaya melampirkan berkas YANG SAMA dua kali berturut-turut
          // tetap memicu onChange; tanpa ini yang kedua diam saja.
          e.target.value = "";
        }}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />
      <button
        onClick={() => input.current?.click?.()}
        disabled={nonaktif}
        aria-label="Lampirkan berkas"
        title="Lampirkan berkas teks, data, atau kode"
        className="aksi-pesan rounded-[var(--radius-kecil)] p-1.5 disabled:opacity-40"
        style={{ color: "var(--redup)" }}
      >
        <IkonLampir ukuran={16} />
      </button>
    </>
  );
}

/**
 * Pembungkus seret-dan-lepas.
 *
 * dragenter/dragleave dihitung dengan penghitung, bukan dengan boolean:
 * kedua peristiwa itu ikut menyala saat kursor melintasi elemen ANAK, jadi
 * boolean akan mematikan sorotan tepat di tengah area lepasnya.
 */
export function AreaLepas({
  onTambah,
  onGalat,
  children,
}: {
  onTambah: (b: Berkas[]) => void;
  onGalat: (pesan: string) => void;
  children: React.ReactNode;
}) {
  const [aktif, setAktif] = useState(0);

  async function proses(daftar: FileList | null) {
    if (!daftar?.length) return;
    const diterima: Berkas[] = [];
    const ditolak: string[] = [];
    for (const f of Array.from(daftar)) {
      try {
        diterima.push(await bacaBerkas(f));
      } catch (e) {
        ditolak.push((e as Error).message);
      }
    }
    if (diterima.length) onTambah(diterima);
    if (ditolak.length) onGalat(ditolak.join(" "));
  }

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        setAktif((n) => n + 1);
      }}
      onDragLeave={() => setAktif((n) => Math.max(0, n - 1))}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        setAktif(0);
        void proses(e.dataTransfer.files);
      }}
      className="relative"
    >
      {children}
      {aktif > 0 && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[var(--radius-besar)] border-2 border-dashed text-[12px]"
          style={{
            borderColor: "var(--surface)",
            background: "color-mix(in oklab, var(--abyss) 78%, transparent)",
            color: "var(--teks-kedua)",
          }}
        >
          Lepaskan berkas di sini
        </div>
      )}
    </div>
  );
}
