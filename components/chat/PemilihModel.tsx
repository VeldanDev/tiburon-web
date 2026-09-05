"use client";

/**
 * Pemilih model untuk percakapan yang sedang berjalan.
 *
 * `/model` milik Hermes, dalam bentuk yang pas untuk Tiburon. Bedanya dari
 * dua hal yang sudah ada, dan kenapa ketiganya tidak saling menggantikan:
 *
 *   Rantai bawaan   urutan cadangan, dipakai kalau tidak ada yang memilih.
 *   Persona         rantai yang MENETAP, milik sebuah cara menjawab.
 *   Pemilih ini     satu model, untuk sesi yang sedang berjalan saja.
 *
 * Tidak disimpan ke basis data dengan sengaja. Yang ingin menetap dipasang
 * lewat persona; yang di sini untuk "coba yang ini dulu" — dan pilihan sesaat
 * yang diam-diam menetap adalah pilihan yang mengejutkan pemiliknya minggu
 * depan.
 *
 * MEMILIH SATU MODEL MEMATIKAN RANTAI CADANGAN, dan itu disebut di
 * tooltipnya. Kalau tidak, gagalnya satu model terlihat seperti Tiburon rusak
 * — padahal itu justru yang diminta pengguna saat ia memaksa satu model.
 */

import { useEffect, useRef, useState } from "react";
import { IkonModel, IkonCentang } from "@/components/Ikon";
import { RANTAI_BAWAAN } from "@/lib/penyedia";

/** Nama pendek: "z-ai/glm-5.2:free" → "glm-5.2". */
export function ringkasNamaModel(model: string): string {
  return model.split("/").pop()?.replace(/:free$/, "") ?? model;
}

export function PemilihModel({
  dipilih,
  onGanti,
  tambahan = [],
}: {
  dipilih: string | null;
  onGanti: (model: string | null) => void;
  /** Model dari rantai persona, kalau percakapan ini memakainya. */
  tambahan?: string[];
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

  // Rantai persona lebih dulu kalau ada — itu yang benar-benar akan dipakai
  // percakapan ini kalau pengguna tidak memilih apa pun.
  const pilihan = [...new Set([...tambahan, ...RANTAI_BAWAAN])];

  return (
    <div ref={bungkus} className="relative">
      <button
        ref={pemicu}
        onClick={() => setBuka((b) => !b)}
        aria-expanded={buka}
        aria-haspopup="menu"
        title={
          dipilih
            ? `Dipaksa ke ${dipilih}. Rantai cadangan mati — kalau model ini gagal, tidak ada yang menggantikan.`
            : "Ikut rantai: model berikutnya dicoba kalau yang sebelumnya gagal."
        }
        aria-label="Pilih model"
        className="aksi-pesan flex items-center gap-1.5 rounded-[var(--radius-kecil)] px-2 py-1 text-[11px]"
        style={{ color: dipilih ? "var(--surface)" : "var(--redup)" }}
      >
        <IkonModel ukuran={12} />
        {dipilih ? ringkasNamaModel(dipilih) : "rantai"}
      </button>

      {buka && (
        <div
          role="menu"
          className="naik absolute bottom-full left-0 z-20 mb-1 min-w-[210px] overflow-hidden rounded-[var(--radius)] border p-1"
          style={{
            borderColor: "var(--garis)",
            background: "var(--lapis-2)",
            boxShadow: "var(--panel)",
          }}
        >
          <button
            role="menuitemradio"
            aria-checked={dipilih === null}
            onClick={() => {
              onGanti(null);
              setBuka(false);
            }}
            className="baris-obrolan flex w-full items-center gap-2 rounded-[var(--radius-kecil)] px-2 py-1.5 text-left text-[12.5px]"
            style={{ color: dipilih === null ? "var(--foam)" : "var(--teks-utama)" }}
          >
            {/* Ruang centangnya selalu ada, terisi atau tidak — kalau tidak,
                labelnya bergeser saat pilihan berpindah. */}
            <span className="w-3 shrink-0">{dipilih === null && <IkonCentang ukuran={11} />}</span>
            Ikut rantai
          </button>

          {pilihan.map((m) => (
            <button
              key={m}
              role="menuitemradio"
              aria-checked={dipilih === m}
              onClick={() => {
                onGanti(m);
                setBuka(false);
              }}
              title={m}
              className="baris-obrolan flex w-full items-center gap-2 rounded-[var(--radius-kecil)] px-2 py-1.5 text-left text-[12.5px]"
              style={{ color: dipilih === m ? "var(--foam)" : "var(--teks-utama)" }}
            >
              <span className="w-3 shrink-0">{dipilih === m && <IkonCentang ukuran={11} />}</span>
              <span className="min-w-0 truncate">{ringkasNamaModel(m)}</span>
            </button>
          ))}

          <p
            className="border-t px-2 pb-1 pt-2 text-[10.5px] leading-[1.5]"
            style={{ borderColor: "var(--garis)", color: "var(--teks-redup)" }}
          >
            Memilih satu model mematikan rantai cadangan, dan berlaku sampai
            kamu menutup tab.
          </p>
        </div>
      )}
    </div>
  );
}
