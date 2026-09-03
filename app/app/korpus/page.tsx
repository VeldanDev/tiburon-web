"use client";

/**
 * Korpus — menelusuri materi sendiri tanpa menyentuh model sama sekali.
 *
 * Ini halaman yang membuat pembeda Tiburon bisa dipegang. Aplikasi lain
 * mengklaim "menjawab dari dokumenmu"; di sini klaimnya bisa diperiksa:
 * ketik apa pun, dan potongan yang SEBENARNYA akan dibaca model muncul apa
 * adanya, dengan nama berkasnya, sebelum satu token pun dikeluarkan.
 *
 * Pencariannya 0,5 ms karena membaca indeks SQLite langsung — jadi mencari
 * di sini benar-benar gratis, dan itu yang membuatnya layak dipakai untuk
 * memeriksa sesuatu, bukan cuma untuk bertanya.
 */

import { useEffect, useRef, useState } from "react";
import { IkonKorpus } from "@/components/Ikon";

type Potongan = { berkas: string; jalur: string; teks: string; skor: number };
type Berkas = { nama: string; jalur: string; potongan: number };

export default function HalamanKorpus() {
  const [kueri, setKueri] = useState("");
  const [potongan, setPotongan] = useState<Potongan[]>([]);
  const [berkas, setBerkas] = useState<Berkas[]>([]);
  const [totalPotongan, setTotalPotongan] = useState(0);
  const [pesan, setPesan] = useState("");
  const [mencari, setMencari] = useState(false);
  const [saring, setSaring] = useState<string | null>(null);

  // Daftar berkas dimuat sekali; ia tidak berubah selama halaman terbuka.
  useEffect(() => {
    let batal = false;
    fetch("/api/korpus/berkas")
      .then((r) => r.json())
      .then((d) => {
        if (batal) return;
        setBerkas(d.berkas ?? []);
        setTotalPotongan(d.totalPotongan ?? 0);
        if (d.pesan) setPesan(d.pesan);
      })
      .catch((e) => !batal && setPesan(`Gagal memuat daftar korpus: ${(e as Error).message}`));
    return () => {
      batal = true;
    };
  }, []);

  // Pencarian ditunda 200 ms setelah ketikan berhenti. Bukan karena mahal —
  // 0,5 ms per pencarian — tapi supaya hasilnya tidak berkedip tiap huruf.
  const jeda = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(jeda.current);
    const q = kueri.trim();
    if (q.length < 2) {
      setPotongan([]);
      setMencari(false);
      return;
    }
    setMencari(true);
    jeda.current = window.setTimeout(() => {
      fetch(`/api/korpus/cari?q=${encodeURIComponent(q)}&batas=30`)
        .then((r) => r.json())
        .then((d) => {
          setPotongan(d.potongan ?? []);
          if (d.pesan) setPesan(d.pesan);
        })
        .catch((e) => setPesan(`Pencarian gagal: ${(e as Error).message}`))
        .finally(() => setMencari(false));
    }, 200);
    return () => window.clearTimeout(jeda.current);
  }, [kueri]);

  const terlihat = saring ? potongan.filter((p) => p.berkas === saring) : potongan;

  return (
    <div className="h-screen overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-1 flex items-center gap-2.5">
          <IkonKorpus ukuran={22} className="ikon-aktif" />
          <h1
            className="text-[30px] leading-tight"
            style={{ color: "var(--teks-utama)", fontFamily: "var(--font-serif)" }}
          >
            Korpus
          </h1>
        </div>
        <p className="mb-6 text-[13px]" style={{ color: "var(--teks-redup)" }}>
          <span className="angka" style={{ color: "var(--teks-kedua)" }}>
            {berkas.length}
          </span>{" "}
          berkas ·{" "}
          <span className="angka" style={{ color: "var(--teks-kedua)" }}>
            {totalPotongan.toLocaleString("id-ID")}
          </span>{" "}
          potongan terindeks. Cari di sini tidak memakai model dan tidak memakan kuota.
        </p>

        <input
          value={kueri}
          onChange={(e) => setKueri(e.target.value)}
          placeholder="Cari di korpusmu…"
          aria-label="Cari di korpus"
          className="mb-2 w-full rounded-[var(--radius)] border px-4 py-2.5 text-[14px] outline-none"
          style={{
            borderColor: "var(--garis)",
            background: "var(--lapis-0)",
            color: "var(--teks-utama)",
          }}
        />

        <div className="mb-6 flex min-h-[20px] items-center gap-2 text-[12px]">
          {mencari ? (
            <span style={{ color: "var(--teks-redup)" }}>mencari…</span>
          ) : kueri.trim().length >= 2 ? (
            <span style={{ color: "var(--teks-kedua)" }}>
              <span className="angka">{terlihat.length}</span> potongan cocok
              {saring && (
                <>
                  {" "}
                  di{" "}
                  <button
                    onClick={() => setSaring(null)}
                    className="underline"
                    style={{ color: "var(--surface)" }}
                  >
                    {saring} ✕
                  </button>
                </>
              )}
            </span>
          ) : (
            <span style={{ color: "var(--teks-redup)" }}>
              Ketik minimal dua huruf.
            </span>
          )}
        </div>

        {pesan && (
          <div
            role="alert"
            className="mb-6 rounded-[var(--radius)] border px-4 py-3 text-[13px]"
            style={{ borderColor: "var(--warn)", color: "var(--warn)" }}
          >
            {pesan}
          </div>
        )}

        {/* Hasil pencarian */}
        <div className="space-y-3">
          {terlihat.map((p, i) => (
            <article
              key={`${p.jalur}-${i}`}
              className="naik rounded-[var(--radius)] border p-3.5"
              style={{
                animationDelay: `${Math.min(i, 8) * 35}ms`,
                borderColor: "var(--garis)",
                background: "var(--lapis-1)",
              }}
            >
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <button
                  onClick={() => setSaring(p.berkas)}
                  className="min-w-0 truncate text-left text-[13px] hover:underline"
                  style={{ color: "var(--teks-kedua)" }}
                  title={p.jalur}
                >
                  {p.berkas}
                </button>
                <span className="angka shrink-0 text-[11px]" style={{ color: "var(--teks-redup)" }}>
                  {p.skor.toFixed(2)}
                </span>
              </div>
              <p
                className="whitespace-pre-wrap text-[13px] leading-[1.7]"
                style={{ color: "var(--teks-utama)" }}
              >
                {p.teks}
              </p>
            </article>
          ))}
        </div>

        {/* Daftar berkas — hanya saat tidak sedang mencari, supaya halaman
            tidak menampilkan dua daftar panjang sekaligus. */}
        {kueri.trim().length < 2 && berkas.length > 0 && (
          <>
            <h2 className="mb-3 mt-2 text-[14px]" style={{ color: "var(--teks-utama)" }}>
              Berkas terindeks
            </h2>
            <div className="space-y-0.5">
              {berkas.map((b) => (
                <div
                  key={b.jalur}
                  className="flex items-baseline justify-between gap-3 rounded-[var(--radius-kecil)] px-3 py-1.5 text-[12px]"
                  title={b.jalur}
                >
                  <span className="min-w-0 truncate" style={{ color: "var(--teks-utama)" }}>
                    {b.nama}
                  </span>
                  <span className="angka shrink-0" style={{ color: "var(--teks-redup)" }}>
                    {b.potongan}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
