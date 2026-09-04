"use client";

/**
 * Pengurut daftar obrolan.
 *
 * Ikonnya sudah ada di sana sejak awal, lengkap dengan kursor penunjuk dan
 * efek hover — tapi tanpa `onClick`. Kontrol yang terlihat bisa ditekan lalu
 * tidak melakukan apa-apa lebih buruk daripada tidak ada kontrolnya: yang
 * pertama membuat orang mengklik berulang kali dan menyimpulkan aplikasinya
 * rusak.
 *
 * Menu, bukan tombol yang berputar antar-keadaan. Tiga urutan yang berganti
 * tiap klik tanpa daftar berarti tidak ada cara mengetahui pilihannya sebelum
 * mencobanya satu per satu.
 */

import { useEffect, useRef, useState } from "react";
import { IkonCentang, IkonUrut } from "@/components/Ikon";

export type Urutan = "terbaru" | "terlama" | "judul";

const KUNCI = "tiburon-urutan-obrolan";

const PILIHAN: { nilai: Urutan; label: string }[] = [
  { nilai: "terbaru", label: "Terbaru dulu" },
  { nilai: "terlama", label: "Terlama dulu" },
  { nilai: "judul", label: "Judul A–Z" },
];

export function bacaUrutan(): Urutan {
  try {
    const t = localStorage.getItem(KUNCI);
    if (t === "terbaru" || t === "terlama" || t === "judul") return t;
  } catch {
    // Penyimpanan ditolak; bawaannya tetap benar.
  }
  return "terbaru";
}

/**
 * Urutkan, dengan yang disemat SELALU di atas.
 *
 * Menyematkan berarti "taruh di atas dan tahan di sana", jadi urutan apa pun
 * yang dipilih hanya berlaku di dalam masing-masing kelompok. Kalau tidak,
 * memilih "Judul A–Z" akan menenggelamkan obrolan yang sengaja disematkan ke
 * tengah daftar — dan sematannya jadi tidak berarti apa-apa.
 */
export function urutkan<T extends { judul: string; diperbarui: number; disemat?: boolean }>(
  daftar: T[],
  urutan: Urutan,
): T[] {
  const banding = (a: T, b: T) => {
    if (urutan === "terlama") return a.diperbarui - b.diperbarui;
    // localeCompare dengan locale Indonesia: tanpa itu "Ápi" dan "Api"
    // terpisah jauh, dan huruf besar selalu mendahului huruf kecil.
    if (urutan === "judul") return a.judul.localeCompare(b.judul, "id");
    return b.diperbarui - a.diperbarui;
  };
  return [...daftar].sort(
    (a, b) => Number(b.disemat ?? false) - Number(a.disemat ?? false) || banding(a, b),
  );
}

export function MenuUrut({
  urutan,
  onGanti,
}: {
  urutan: Urutan;
  onGanti: (u: Urutan) => void;
}) {
  const [buka, setBuka] = useState(false);
  const bungkus = useRef<HTMLDivElement>(null);
  const pemicu = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!buka) return;
    function keluar(e: MouseEvent) {
      if (!bungkus.current?.contains(e.target as Node)) setBuka(false);
    }
    function esc(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setBuka(false);
      pemicu.current?.focus();
    }
    document.addEventListener("mousedown", keluar, true);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", keluar, true);
      document.removeEventListener("keydown", esc);
    };
  }, [buka]);

  const aktif = PILIHAN.find((p) => p.nilai === urutan) ?? PILIHAN[0];

  return (
    <div ref={bungkus} className="relative">
      <button
        ref={pemicu}
        onClick={() => setBuka((b) => !b)}
        aria-expanded={buka}
        aria-haspopup="menu"
        // Urutan yang berlaku disebut di judulnya. Ikon sendirian tidak pernah
        // bisa mengatakan keadaan mana yang sedang aktif.
        title={`Urutkan obrolan — ${aktif.label.toLowerCase()}`}
        aria-label={`Urutkan obrolan, sekarang ${aktif.label.toLowerCase()}`}
        className="aksi-pesan rounded-[var(--radius-kecil)] p-1"
        style={{ color: "var(--redup)" }}
      >
        <IkonUrut ukuran={13} />
      </button>

      {buka && (
        <div
          role="menu"
          className="naik absolute right-0 top-full z-20 mt-1 min-w-[150px] overflow-hidden rounded-[var(--radius)] border p-1"
          style={{
            borderColor: "var(--garis)",
            background: "var(--lapis-2)",
            boxShadow: "var(--panel)",
          }}
        >
          {PILIHAN.map((p) => (
            <button
              key={p.nilai}
              role="menuitemradio"
              aria-checked={p.nilai === urutan}
              onClick={() => {
                onGanti(p.nilai);
                setBuka(false);
                try {
                  localStorage.setItem(KUNCI, p.nilai);
                } catch {
                  // Urutannya tetap berganti untuk sesi ini.
                }
              }}
              className="baris-obrolan flex w-full items-center gap-2 rounded-[var(--radius-kecil)] px-2 py-1.5 text-left text-[12.5px]"
              style={{ color: p.nilai === urutan ? "var(--foam)" : "var(--teks-utama)" }}
            >
              {/* Ruang centangnya SELALU ada, terisi atau tidak. Kalau tidak,
                  label bergeser saat pilihan berpindah. */}
              <span className="w-3 shrink-0">
                {p.nilai === urutan && <IkonCentang ukuran={11} />}
              </span>
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
