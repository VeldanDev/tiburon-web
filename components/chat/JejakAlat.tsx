"use client";

/**
 * Jejak panggilan alat di dalam jawaban agen.
 *
 * Ini bagian yang paling penting dari mode agen, dan alasannya bukan estetika:
 * agen yang bekerja diam-diam lalu menyodorkan jawaban tidak bisa dipercaya
 * lebih dari model biasa. Yang membuatnya bisa dipercaya adalah TERLIHATNYA
 * apa yang ia baca — pencarian apa, hasilnya apa, dan apakah jawabannya
 * benar-benar berasal dari situ.
 *
 * Hasil alat runtuh secara bawaan tapi bisa dibuka. Yang perlu dilihat
 * sekilas adalah "ia mencari X"; yang perlu diperiksa saat curiga adalah
 * "dan inilah yang ia dapat".
 */

import { useState } from "react";
import { IkonLipat, IkonCentang } from "@/components/Ikon";

export type Jejak = {
  nama: string;
  ringkas: string;
  /** Belum terisi selama alatnya masih berjalan. */
  hasil?: string;
};

export function JejakAlat({ jejak }: { jejak: Jejak[] }) {
  if (jejak.length === 0) return null;
  return (
    <div className="mb-3 space-y-1">
      {jejak.map((j, i) => (
        <BarisJejak key={`${j.nama}-${i}`} jejak={j} />
      ))}
    </div>
  );
}

function BarisJejak({ jejak }: { jejak: Jejak }) {
  const [buka, setBuka] = useState(false);
  const selesai = jejak.hasil !== undefined;

  return (
    <div
      className="naik overflow-hidden rounded-[var(--radius-kecil)] border"
      style={{ borderColor: "var(--garis)", background: "var(--lapis-0)" }}
    >
      <button
        onClick={() => selesai && setBuka((b) => !b)}
        disabled={!selesai}
        aria-expanded={buka}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px]"
        style={{ color: "var(--teks-redup)" }}
      >
        {selesai ? (
          <IkonCentang ukuran={11} className="shrink-0" />
        ) : (
          // Denyut sonar yang sama seperti saat mencari korpus di jalur
          // Tiburon: satu bahasa visual untuk satu arti, "sedang mencari".
          <span
            aria-hidden
            className="sonar-cincin h-2 w-2 shrink-0 rounded-full"
            style={{ background: "var(--surface)" }}
          />
        )}
        <span className="min-w-0 flex-1 truncate">{jejak.ringkas}</span>
        {selesai && (
          <IkonLipat ukuran={10} className={buka ? "ikon-lipat-buka" : undefined} />
        )}
      </button>

      {buka && jejak.hasil !== undefined && (
        <pre
          className="max-h-64 overflow-auto border-t px-2.5 py-2 text-[11px] leading-[1.6]"
          style={{
            borderColor: "var(--garis)",
            color: "var(--teks-utama)",
            whiteSpace: "pre-wrap",
            // Hasil alat bisa panjang sekali (enam potongan korpus). Dibatasi
            // tingginya dan digulir di dalam kotaknya sendiri, bukan
            // memanjangkan seluruh percakapan.
            fontFamily: "var(--font-mono)",
          }}
        >
          {jejak.hasil || "(kosong)"}
        </pre>
      )}
    </div>
  );
}
