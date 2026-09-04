"use client";

/**
 * Menu akun di dasar sidebar.
 *
 * Tiburon tidak punya akun — satu orang, satu mesin, satu basis data di
 * folder `data/`. Jadi menu ini sengaja TIDAK meniru menu akun aplikasi lain
 * (profil, langganan, keluar): semua isinya akan bohong. Yang tersisa setelah
 * kebohongan itu dibuang justru yang paling sering dipakai — tema, dan tiga
 * pintu ke pengaturan yang dituju orang secara langsung.
 *
 * "Bahasa" juga tidak ada di sini walau aplikasi rujukan punya. Seluruh
 * antarmuka ini ditulis dalam satu bahasa; pemilih bahasa yang cuma punya satu
 * pilihan adalah kontrol yang terlihat rusak, bukan kontrol yang lengkap.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PemilihTema } from "@/components/PemilihTema";
import { jalurBagian } from "@/lib/bagian-pengaturan";
import {
  IkonAtur,
  IkonPelampung,
  IkonPintasan,
  IkonTiburon,
  IkonTurun,
} from "@/components/Ikon";

const PINTU: { label: string; href: string; Ikon: (p: { ukuran?: number }) => React.ReactElement }[] =
  [
    { label: "Pengaturan", href: jalurBagian("instruksi"), Ikon: IkonAtur },
    { label: "Ingatan", href: jalurBagian("ingatan"), Ikon: IkonPelampung },
    { label: "Pintasan papan ketik", href: jalurBagian("pintasan"), Ikon: IkonPintasan },
    { label: "Tentang Tiburon", href: jalurBagian("tentang"), Ikon: IkonTiburon },
  ];

export function MenuAkun() {
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
      // Fokus dikembalikan ke pemicunya. Tanpa ini, menutup dengan Esc
      // membuang fokus ke <body> dan pengguna papan ketik harus menelusuri
      // seluruh sidebar dari awal untuk kembali ke tempatnya tadi.
      pemicu.current?.focus();
    }

    // Ditangkap pada fase capture: sebuah tautan di dalam menu memindahkan
    // halaman dan melepas simpulnya sebelum fase bubble sempat berjalan.
    document.addEventListener("mousedown", keluar, true);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", keluar, true);
      document.removeEventListener("keydown", esc);
    };
  }, [buka]);

  return (
    <div ref={bungkus} className="relative border-t" style={{ borderColor: "var(--garis)" }}>
      {buka && (
        <div
          // Menu berlabuh ke ATAS pemicunya: ia duduk di dasar sidebar, dan
          // ruang kosongnya cuma ada di atas. `naik` sudah bergerak ke arah
          // yang sama -- muncul dari bawah -- jadi tidak ada gerak baru yang
          // perlu ditulis, dan reduced motion sudah tertangani di sana.
          className="naik absolute bottom-full left-3 right-3 mb-2 overflow-hidden rounded-[var(--radius)] border"
          style={{
            borderColor: "var(--garis)",
            background: "var(--lapis-2)",
            boxShadow: "var(--panel)",
            transformOrigin: "bottom center",
          }}
          role="dialog"
          aria-label="Menu akun"
        >
          <div
            className="flex items-center justify-between gap-3 border-b px-3 py-2.5"
            style={{ borderColor: "var(--garis)" }}
          >
            <span className="text-[12px]" style={{ color: "var(--teks-redup)" }}>
              Tampilan
            </span>
            <PemilihTema />
          </div>

          <div className="p-1">
            {PINTU.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                onClick={() => setBuka(false)}
                className="baris-obrolan flex items-center gap-2.5 rounded-[var(--radius-kecil)] px-2.5 py-2 text-[13px]"
                style={{ color: "var(--teks-utama)" }}
              >
                <p.Ikon ukuran={15} />
                {p.label}
              </Link>
            ))}
          </div>

          {/* Satu kalimat yang menjelaskan kenapa menu ini sependek ini. */}
          <p
            className="border-t px-3 py-2 text-[11px] leading-[1.6]"
            style={{ borderColor: "var(--garis)", color: "var(--teks-redup)" }}
          >
            Tidak ada akun untuk keluar. Seluruh riwayatmu ada di berkas di mesin
            ini.
          </p>
        </div>
      )}

      <button
        ref={pemicu}
        onClick={() => setBuka((b) => !b)}
        aria-expanded={buka}
        aria-haspopup="dialog"
        className="baris-obrolan flex w-full items-center gap-2.5 px-4 py-3 text-left text-[13px]"
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] leading-none"
          style={{ background: "var(--ocean)", color: "var(--shell)" }}
        >
          V
        </span>
        {/* min-w-0 pada pembungkus: tanpa itu nama panjang mendorong baris
            melewati lebar sidebar, bukan terpotong di dalamnya. */}
        <span className="min-w-0 flex-1 truncate" style={{ color: "var(--shell)" }}>
          Veldan
        </span>
        <span className="shrink-0 text-[11px]" style={{ color: "var(--redup)" }}>
          lokal
        </span>
        {/* Panah yang sama BERBALIK, bukan dua bentuk yang bertukar -- aturan
            yang sudah dipakai kartu sumber. Berbalik penuh, bukan seperempat:
            menunya terbuka ke atas. */}
        <IkonTurun
          ukuran={13}
          className={`ikon-balik${buka ? " ikon-balik-buka" : ""}`}
        />
      </button>
    </div>
  );
}
