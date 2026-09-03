"use client";

/**
 * Gelembung pesan pengguna, yang bisa disunting.
 *
 * Menyunting pertanyaan MEMBUANG semua jawaban di bawahnya, bukan menyisipkan
 * versi baru di tengah riwayat. Itu bukan penyederhanaan — percakapan adalah
 * rantai sebab-akibat, dan jawaban yang muncul karena pertanyaan versi lama
 * tidak lagi berarti apa-apa begitu pertanyaannya berubah. Menyimpannya
 * menghasilkan riwayat yang tidak mungkin terjadi.
 *
 * Konsekuensi itu disebutkan langsung di antarmuka, sebelum tombolnya ditekan,
 * bukan setelahnya.
 */

import { useEffect, useRef, useState } from "react";
import { IkonSunting } from "@/components/Ikon";

export function PesanPengguna({
  isi,
  sibuk,
  onSunting,
}: {
  isi: string;
  sibuk: boolean;
  onSunting: (baru: string) => void;
}) {
  const [sunting, setSunting] = useState(false);
  const [draf, setDraf] = useState(isi);
  const kotak = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!sunting) return;
    const el = kotak.current;
    if (!el) return;
    el.focus?.();
    // Kursor ditaruh di AKHIR teks, bukan menyeleksi semuanya: menyunting
    // biasanya berarti menambah atau membetulkan sedikit, dan seleksi penuh
    // membuat ketikan pertama menghapus seluruh pertanyaan.
    el.setSelectionRange?.(el.value.length, el.value.length);
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [sunting]);

  function kirim() {
    const bersih = draf.trim();
    setSunting(false);
    if (!bersih || bersih === isi) {
      setDraf(isi);
      return;
    }
    onSunting(bersih);
  }

  if (sunting) {
    return (
      <div className="flex justify-end">
        <div className="w-full max-w-[85%]">
          <textarea
            ref={kotak}
            value={draf}
            onChange={(e) => {
              setDraf(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                kirim();
              }
              if (e.key === "Escape") {
                setDraf(isi);
                setSunting(false);
              }
            }}
            rows={1}
            aria-label="Sunting pertanyaan"
            className="w-full resize-none rounded-[var(--radius-besar)] border px-4 py-2.5 text-[14px] outline-none"
            style={{
              borderColor: "var(--surface)",
              background: "var(--lapis-2)",
              color: "var(--teks-utama)",
            }}
          />
          <div className="mt-1.5 flex items-center justify-end gap-2 text-[11px]">
            <span style={{ color: "var(--teks-redup)" }}>
              Jawaban di bawahnya akan diganti
            </span>
            <button
              onClick={() => {
                setDraf(isi);
                setSunting(false);
              }}
              className="aksi-pesan rounded-[var(--radius-kecil)] px-2 py-1"
              style={{ color: "var(--redup)" }}
            >
              batal
            </button>
            <button
              onClick={kirim}
              className="rounded-[var(--radius-kecil)] px-2.5 py-1"
              style={{ background: "var(--ocean)", color: "var(--shell)" }}
            >
              kirim ulang
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="baris-obrolan flex items-center justify-end gap-1.5">
      {/* Tombol sunting di KIRI gelembung: gelembungnya rata kanan, jadi
          menaruh tombol di kanan akan mendorongnya menjauh dari tepi dan
          membuat setiap pesan pengguna tampak tidak sejajar. */}
      <button
        onClick={() => {
          setDraf(isi);
          setSunting(true);
        }}
        disabled={sibuk}
        aria-label="Sunting pertanyaan ini"
        title="Sunting dan kirim ulang"
        className="aksi-pesan aksi-obrolan rounded-[var(--radius-kecil)] p-1 disabled:opacity-40"
        style={{ color: "var(--redup)" }}
      >
        <IkonSunting ukuran={12} />
      </button>
      <div
        className="max-w-[85%] whitespace-pre-wrap rounded-[var(--radius-besar)] px-4 py-2.5 text-[14px]"
        style={{ background: "var(--ocean)", color: "var(--shell)" }}
      >
        {isi}
      </div>
    </div>
  );
}
