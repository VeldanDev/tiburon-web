"use client";

/**
 * Bagian proyek di sidebar.
 *
 * Runtuh secara bawaan dan hanya membentang saat diklik. Proyek dibuka
 * sesekali; percakapan dibuka terus-menerus. Daftar proyek yang selalu
 * terbentang mendorong daftar percakapan — yang jauh lebih sering dipakai —
 * ke bawah lipatan layar.
 */

import { useState } from "react";
import Link from "next/link";
import { IkonLipat, IkonBaru, IkonKorpus } from "@/components/Ikon";

export type Proyek = {
  id: string;
  nama: string;
  instruksi: string;
  dibuat: number;
  jumlah: number;
};

export function DaftarProyek({
  proyek,
  onBuat,
}: {
  proyek: Proyek[];
  onBuat: (nama: string) => void;
}) {
  const [buka, setBuka] = useState(false);
  const [nama, setNama] = useState("");
  const [menambah, setMenambah] = useState(false);

  function simpan() {
    const bersih = nama.trim();
    setMenambah(false);
    setNama("");
    if (bersih) {
      onBuat(bersih);
      // Dibuka otomatis setelah membuat: proyek baru yang tidak terlihat
      // membuat tombolnya terasa tidak melakukan apa-apa.
      setBuka(true);
    }
  }

  return (
    <div className="px-3">
      <button
        onClick={() => setBuka((b) => !b)}
        aria-expanded={buka}
        className="flex w-full items-center gap-1.5 px-3 pb-1 pt-3 text-[12px]"
        style={{ color: "var(--redup)" }}
      >
        <IkonLipat ukuran={11} className={buka ? "ikon-lipat-buka" : undefined} />
        Proyek
        {proyek.length > 0 && <span className="angka">{proyek.length}</span>}
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            setBuka(true);
            setMenambah(true);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            e.stopPropagation();
            setBuka(true);
            setMenambah(true);
          }}
          aria-label="Proyek baru"
          className="aksi-pesan ml-auto rounded-[var(--radius-kecil)] p-0.5"
        >
          <IkonBaru ukuran={12} />
        </span>
      </button>

      {buka && (
        <>
          {menambah && (
            <input
              autoFocus
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              onBlur={simpan}
              onKeyDown={(e) => {
                if (e.key === "Enter") simpan();
                if (e.key === "Escape") {
                  setNama("");
                  setMenambah(false);
                }
              }}
              placeholder="Nama proyek…"
              aria-label="Nama proyek baru"
              className="mb-1 w-full rounded-[var(--radius-kecil)] border px-2.5 py-1.5 text-[12px] outline-none"
              style={{
                borderColor: "var(--surface)",
                background: "var(--lapis-0)",
                color: "var(--teks-utama)",
              }}
            />
          )}

          {proyek.length === 0 && !menambah ? (
            <p className="px-3 pb-1 text-[11px]" style={{ color: "var(--redup)" }}>
              Belum ada. Proyek menyimpan konteks yang berlaku untuk semua
              obrolan di dalamnya.
            </p>
          ) : (
            proyek.map((p) => (
              <Link
                key={p.id}
                href={`/app/proyek/${p.id}`}
                className="baris-nav flex items-center gap-2 rounded-[var(--radius)] px-3 py-1.5 text-[13px]"
                style={{ color: "var(--shell)" }}
              >
                <IkonKorpus ukuran={13} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">{p.nama}</span>
                {/* Titik kecil menandai proyek yang PUNYA instruksi. Tanpa
                    penanda ini, satu-satunya cara tahu adalah membuka
                    satu per satu — padahal itulah yang membedakan proyek
                    dari sekadar folder. */}
                {p.instruksi.trim() && (
                  <span
                    aria-label="punya instruksi"
                    title="Punya instruksi proyek"
                    className="h-1 w-1 shrink-0 rounded-full"
                    style={{ background: "var(--surface)" }}
                  />
                )}
                <span className="angka shrink-0 text-[11px]" style={{ color: "var(--redup)" }}>
                  {p.jumlah}
                </span>
              </Link>
            ))
          )}
        </>
      )}
    </div>
  );
}
