"use client";

/**
 * Menu perintah — muncul saat kotak ketik diawali "/".
 *
 * Gagasannya dari Antigravity ("/ for actions"), tapi isinya milik Tiburon:
 * tiap perintah memetakan ke sesuatu yang benar-benar bisa dilakukan aplikasi
 * ini, bukan daftar hiasan.
 *
 * Tanpa animasi buka-tutup. Menu ini dipanggil dengan mengetik satu karakter
 * dan ditutup dengan mengetik karakter berikutnya -- puluhan kali sehari.
 * Animasi di sana jadi hambatan, bukan bantuan.
 */

import type { Jalur } from "@/components/chat/PemilihJalur";

export type Perintah = {
  kunci: string;
  ringkas: string;
  jalur?: Jalur;
  isi?: string;
  tuju?: string;
};

export const PERINTAH: Perintah[] = [
  {
    kunci: "/korpus",
    // Jumlah berkasnya TIDAK disebut di sini. Angka 164 sempat menetap
    // berbulan-bulan sementara korpusnya berisi 8 berkas, dan menu ini
    // tidak boleh memanggil API cuma untuk sebuah keterangan.
    ringkas: "Tanya korpus pribadimu, jawabannya menyebut berkas sumbernya",
    jalur: "tiburon",
  },
  { kunci: "/cepat", ringkas: "Jawab tanpa menyentuh korpus", jalur: "cepat" },
  { kunci: "/kode", ringkas: "Turun ke dasar — tools dan exec lewat gateway", jalur: "kode" },
  { kunci: "/radar", ringkas: "Buka laporan radar pagi", tuju: "/app/radar" },
  {
    kunci: "/sumber",
    ringkas: "Cari berkas di korpus tanpa bertanya ke model",
    jalur: "tiburon",
    isi: "Cari di korpus: ",
  },
];

export function MenuPerintah({
  kueri,
  onPilih,
}: {
  kueri: string;
  onPilih: (p: Perintah) => void;
}) {
  const cocok = PERINTAH.filter((p) => p.kunci.startsWith(kueri.toLowerCase()));
  if (cocok.length === 0) return null;

  return (
    <div
      role="listbox"
      aria-label="Perintah"
      className="mb-2 overflow-hidden rounded-[var(--radius)] border"
      style={{ borderColor: "var(--garis)", background: "var(--deep)" }}
    >
      {cocok.map((p) => (
        <button
          key={p.kunci}
          role="option"
          aria-selected={false}
          onClick={() => onPilih(p)}
          className="baris-nav flex w-full items-baseline gap-3 px-3 py-2 text-left"
        >
          <span className="text-[13px]" style={{ color: "var(--surface)" }}>
            {p.kunci}
          </span>
          <span className="text-[12px]" style={{ color: "var(--redup)" }}>
            {p.ringkas}
          </span>
        </button>
      ))}
    </div>
  );
}
