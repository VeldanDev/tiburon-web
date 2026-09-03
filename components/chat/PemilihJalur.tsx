"use client";

import { IkonCepat, IkonKode, IkonTiburon } from "@/components/Ikon";

export type Jalur = "cepat" | "tiburon" | "kode";

/** Kedalaman = jalur. Latar berubah supaya jalur aktif terasa, bukan dibaca. */
export const LATAR_JALUR: Record<Jalur, string> = {
  cepat: "var(--latar-cepat)",
  tiburon: "var(--latar-tiburon)",
  kode: "var(--latar-kode)",
};

const LABEL: Record<Jalur, string> = {
  cepat: "Cepat",
  tiburon: "Tiburon",
  kode: "Kode",
};

const IKON: Record<Jalur, (p: { ukuran?: number; className?: string }) => React.ReactElement> = {
  cepat: IkonCepat,
  tiburon: IkonTiburon,
  kode: IkonKode,
};

export function PemilihJalur({
  jalur, onGanti,
}: { jalur: Jalur; onGanti: (j: Jalur) => void }) {
  return (
    <div className="flex gap-1" role="tablist">
      {(Object.keys(LABEL) as Jalur[]).map((j) => (
        <button
          key={j}
          role="tab"
          aria-selected={j === jalur}
          onClick={() => onGanti(j)}
          className={`relative rounded-full px-3 py-1 text-sm transition ${
            j === jalur ? "bg-white/15 font-medium" : "opacity-60 hover:opacity-100"
          }`}
        >
          <span className="flex items-center gap-1.5">
            {IKON[j]({ ukuran: 14, className: j === jalur ? "ikon-aktif" : undefined })}
            {LABEL[j]}
          </span>
          {j === jalur && (
            /* Gigi hiu: satu elemen tajam di antara sudut-sudut membulat. */
            <span
              aria-hidden
              className="absolute -bottom-1 left-1/2 h-0 w-0 -translate-x-1/2
                         border-x-4 border-t-4 border-x-transparent"
              style={{ borderTopColor: "var(--surface)" }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
