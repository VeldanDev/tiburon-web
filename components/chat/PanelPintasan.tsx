"use client";

/**
 * Daftar pintasan papan ketik.
 *
 * Dibuat dari SATU sumber data yang juga dipakai untuk mendaftarkan
 * pendengarnya, supaya panel ini tidak bisa perlahan berbohong. Panel pintasan
 * yang ditulis tangan terpisah dari kodenya selalu berakhir menyebut pintasan
 * yang sudah dihapus — dan itu lebih buruk daripada tidak punya panel sama
 * sekali.
 *
 * Tampil sebagai dialog terpusat, bukan panel samping: ia dibuka sesekali,
 * dibaca, lalu ditutup. Tidak ada yang perlu dikerjakan sambil membukanya.
 */

import { useEffect } from "react";
import { IkonTutup } from "@/components/Ikon";

export const PINTASAN: { tombol: string[]; arti: string }[] = [
  { tombol: ["Enter"], arti: "Kirim pesan" },
  { tombol: ["Shift", "Enter"], arti: "Baris baru" },
  { tombol: ["Esc"], arti: "Hentikan jawaban yang sedang mengalir" },
  { tombol: ["Ctrl", "1"], arti: "Jalur Cepat — permukaan, tanpa korpus" },
  { tombol: ["Ctrl", "2"], arti: "Jalur Tiburon — membaca korpusmu" },
  { tombol: ["Ctrl", "3"], arti: "Jalur Kode — paling dalam" },
  { tombol: ["/"], arti: "Buka menu perintah" },
  { tombol: ["?"], arti: "Buka daftar ini" },
];

export function PanelPintasan({ onTutup }: { onTutup: () => void }) {
  useEffect(() => {
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") onTutup();
    }
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onTutup]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "color-mix(in oklab, var(--abyss) 72%, transparent)" }}
      onClick={onTutup}
      role="dialog"
      aria-modal="true"
      aria-label="Pintasan papan ketik"
    >
      <div
        // Klik di dalam panel tidak boleh menutupnya; tanpa ini, memilih teks
        // di dalam dialog akan menutup dialognya saat tombol tetikus dilepas.
        onClick={(e) => e.stopPropagation()}
        className="naik w-full max-w-md overflow-hidden rounded-[var(--radius-besar)] border"
        style={{
          borderColor: "var(--garis)",
          background: "var(--lapis-1)",
          boxShadow: "var(--panel)",
        }}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: "var(--garis)" }}
        >
          <h2
            className="text-[17px]"
            style={{ color: "var(--teks-utama)", fontFamily: "var(--font-serif)" }}
          >
            Pintasan papan ketik
          </h2>
          <button
            onClick={onTutup}
            aria-label="Tutup"
            className="aksi-pesan rounded-[var(--radius-kecil)] p-1"
            style={{ color: "var(--redup)" }}
          >
            <IkonTutup ukuran={14} />
          </button>
        </div>

        <div className="p-2">
          {PINTASAN.map((p) => (
            <div
              key={p.arti}
              className="flex items-center justify-between gap-4 rounded-[var(--radius-kecil)] px-2.5 py-1.5 text-[13px]"
            >
              <span style={{ color: "var(--teks-utama)" }}>{p.arti}</span>
              <span className="flex shrink-0 items-center gap-1">
                {p.tombol.map((t) => (
                  <kbd
                    key={t}
                    className="rounded-[3px] border px-1.5 py-0.5 text-[11px]"
                    style={{
                      borderColor: "var(--garis)",
                      background: "var(--lapis-0)",
                      color: "var(--teks-kedua)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {t}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
