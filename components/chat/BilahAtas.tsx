"use client";

/**
 * Bilah tipis di atas percakapan: ekspor, cabang, dan pintasan.
 *
 * Hanya muncul kalau sudah ada pesan. Bilah yang menawarkan "ekspor" dan
 * "cabang" di atas layar kosong menawarkan tindakan yang tidak mungkin
 * dilakukan, dan tiga tombol mati adalah hal pertama yang dilihat pengguna
 * saat membuka aplikasi.
 */

import { useEffect, useRef, useState } from "react";
import { MeterKonteks } from "@/components/chat/MeterKonteks";
import {
  IkonUnduh,
  IkonCabang,
  IkonPintasan,
  IkonBerkas,
  IkonKode,
} from "@/components/Ikon";

export function BilahAtas({
  judul,
  jumlahPesan,
  pesan,
  onEksporMd,
  onEksporJson,
  onCabang,
  onPintasan,
}: {
  judul: string;
  jumlahPesan: number;
  pesan: { isi: string }[];
  onEksporMd: () => void;
  onEksporJson: () => void;
  onCabang: () => void;
  onPintasan: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const bungkus = useRef<HTMLDivElement>(null);

  // Menu tertutup saat klik di luar ATAU saat Escape. Menu yang hanya bisa
  // ditutup dengan mengklik tombolnya lagi terasa tersangkut.
  useEffect(() => {
    if (!menu) return;
    function luar(e: MouseEvent) {
      if (!bungkus.current?.contains(e.target as Node)) setMenu(false);
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") setMenu(false);
    }
    document.addEventListener("mousedown", luar);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", luar);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  const gaya = { color: "var(--redup)" } as const;

  return (
    <div
      className="flex shrink-0 items-center gap-2 border-b px-6 py-2"
      style={{ borderColor: "var(--garis)" }}
    >
      <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: "var(--teks-redup)" }}>
        {judul}
      </span>
      <MeterKonteks pesan={pesan} />
      <span className="angka shrink-0 text-[11px]" style={{ color: "var(--teks-redup)" }}>
        {jumlahPesan} pesan
      </span>

      <button
        onClick={onCabang}
        aria-label="Cabangkan percakapan"
        title="Salin jadi percakapan baru, lalu lanjutkan dari sini"
        className="aksi-pesan rounded-[var(--radius-kecil)] p-1.5"
        style={gaya}
      >
        <IkonCabang ukuran={14} />
      </button>

      <div ref={bungkus} className="relative">
        <button
          onClick={() => setMenu((m) => !m)}
          aria-label="Ekspor percakapan"
          aria-expanded={menu}
          title="Ekspor"
          className="aksi-pesan rounded-[var(--radius-kecil)] p-1.5"
          style={gaya}
        >
          <IkonUnduh ukuran={14} />
        </button>
        {menu && (
          <div
            className="naik absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-[var(--radius)] border"
            style={{
              borderColor: "var(--garis)",
              background: "var(--lapis-2)",
              boxShadow: "var(--panel)",
            }}
          >
            {[
              { Ikon: IkonBerkas, label: "Markdown", aksi: onEksporMd },
              { Ikon: IkonKode, label: "JSON", aksi: onEksporJson },
            ].map((b) => (
              <button
                key={b.label}
                onClick={() => {
                  b.aksi();
                  setMenu(false);
                }}
                className="baris-nav flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12px]"
                style={{ color: "var(--teks-utama)" }}
              >
                <b.Ikon ukuran={13} />
                {b.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onPintasan}
        aria-label="Pintasan papan ketik"
        title="Pintasan papan ketik (?)"
        className="aksi-pesan rounded-[var(--radius-kecil)] p-1.5"
        style={gaya}
      >
        <IkonPintasan ukuran={14} />
      </button>
    </div>
  );
}
