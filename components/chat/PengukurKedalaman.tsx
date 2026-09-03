"use client";

/**
 * Pengukur kedalaman.
 *
 * Tiga jalur Tiburon bukan tab — itu kedalaman. Jalur Cepat ada di permukaan,
 * jalur korpus di zona senja, jalur kode di dasar yang gelap. Instrumen ini
 * meminjam bentuk komputer selam: skala vertikal, penanda yang bergerak,
 * angka meter yang berubah.
 *
 * Kenapa ini yang dipilih sebagai satu-satunya elemen mencolok: dia datang
 * dari dunia subjeknya sendiri (laut dalam, hiu), bukan dari kotak peralatan
 * antarmuka yang dipakai semua orang. Tidak ada aplikasi chat lain yang punya
 * pengukur kedalaman.
 *
 * Gerak: penanda berpindah 180ms. Jalur diganti puluhan kali sehari, jadi
 * gerakannya harus cepat dan nyaris tak terasa — bukan pertunjukan.
 */

import type { Jalur } from "@/components/chat/PemilihJalur";

const ZONA: { jalur: Jalur; meter: string; nama: string; posisi: number }[] = [
  { jalur: "cepat", meter: "0", nama: "permukaan", posisi: 0 },
  { jalur: "tiburon", meter: "200", nama: "zona senja", posisi: 40 },
  { jalur: "agen", meter: "600", nama: "menyisir", posisi: 70 },
  { jalur: "kode", meter: "1000", nama: "dasar", posisi: 100 },
];

export function PengukurKedalaman({ jalur }: { jalur: Jalur }) {
  const aktif = ZONA.find((z) => z.jalur === jalur) ?? ZONA[0];

  return (
    <div
      className="flex select-none flex-col items-center gap-2 py-6"
      aria-hidden
      title={`${aktif.meter} m — ${aktif.nama}`}
    >
      <span className="text-[9px]" style={{ color: "var(--redup)" }}>
        0
      </span>

      {/* Batang skala. Gradien dari terang ke gelap = cahaya yang habis
          seiring kedalaman. */}
      <div
        className="relative w-px flex-1"
        style={{
          minHeight: 120,
          background:
            "linear-gradient(to bottom, var(--surface), var(--ocean) 45%, var(--abyss))",
        }}
      >
        {/* Penanda posisi. transform: translateY saja — tidak menyentuh
            layout, jadi tetap mulus di GPU. */}
        <div
          className="absolute left-1/2 h-2 w-2 -translate-x-1/2 rounded-full"
          style={{
            top: `${aktif.posisi}%`,
            marginTop: -4,
            background: "var(--surface)",
            boxShadow: "var(--pendar-kuat)",
            transition: "top 180ms var(--keluar)",
          }}
        />
      </div>

      <span
        className="angka text-[9px] leading-none"
        style={{ color: "var(--surface)" }}
      >
        {aktif.meter}
      </span>
      <span className="text-[9px]" style={{ color: "var(--redup)" }}>
        m
      </span>
    </div>
  );
}
