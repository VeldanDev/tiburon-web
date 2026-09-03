"use client";

/**
 * Salju laut (marine snow).
 *
 * Fenomena nyata: di laut dalam, serpihan organik terus-menerus turun dari
 * permukaan seperti salju. Itu satu-satunya hal yang bergerak di kegelapan
 * sana, dan penyelam mengenalinya seketika.
 *
 * Dipakai sebagai atmosfer, bukan hiasan: HANYA muncul di kedalaman (jalur
 * Tiburon dan Kode), tidak pernah di permukaan. Kerapatannya bertambah makin
 * dalam. Jadi ia membawa informasi — kamu tahu sedang di kedalaman berapa
 * tanpa membaca angka.
 *
 * Gerak: CSS animation murni pada transform dan opacity, jadi berjalan di luar
 * main thread dan tidak pernah menjatuhkan frame walau halaman sibuk memuat.
 * Dimatikan penuh saat pengguna meminta reduced motion — ini gerakan yang
 * tidak dipicu pengguna, jadi ia yang pertama harus pergi.
 */

import { useMemo } from "react";
import type { Jalur } from "@/components/chat/PemilihJalur";

const JUMLAH: Record<Jalur, number> = {
  cepat: 0, // permukaan: tidak ada salju laut, ada cahaya matahari
  tiburon: 14, // zona senja
  agen: 20, // lebih dalam dari zona senja, belum sampai dasar
  kode: 26, // dasar
};

export function SaljuLaut({ jalur }: { jalur: Jalur }) {
  const jumlah = JUMLAH[jalur];

  // Posisi dan waktu diacak sekali per jumlah, bukan tiap render — kalau
  // diacak ulang tiap render, seluruh partikel melompat tiap kali state
  // berubah.
  const butir = useMemo(
    () =>
      Array.from({ length: jumlah }, (_, i) => ({
        kiri: (i * 37 + 11) % 100,
        tunda: (i * 1.7) % 18,
        durasi: 16 + ((i * 3) % 14),
        ukuran: i % 5 === 0 ? 2 : 1,
        buram: i % 3 === 0 ? 0.28 : 0.16,
      })),
    [jumlah],
  );

  if (jumlah === 0) return null;

  return (
    <div
      aria-hidden
      className="salju-laut pointer-events-none absolute inset-0 overflow-hidden"
    >
      {butir.map((b, i) => (
        <span
          key={i}
          className="salju-butir absolute rounded-full"
          style={{
            left: `${b.kiri}%`,
            width: b.ukuran,
            height: b.ukuran,
            background: "var(--butir)",
            opacity: b.buram,
            animationDelay: `-${b.tunda}s`,
            animationDuration: `${b.durasi}s`,
          }}
        />
      ))}
    </div>
  );
}
