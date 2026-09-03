"use client";

/**
 * Pengaturan: instruksi khusus dan ingatan tetap.
 *
 * Keduanya masuk ke SETIAP percakapan, jadi halaman ini menunjukkan tepat apa
 * yang akan dibaca model — bukan ringkasan atau janji. Ingatan yang tidak bisa
 * dilihat dan dihapus adalah ingatan yang diam-diam mewarnai setiap jawaban
 * tanpa pemiliknya tahu kenapa, dan seluruh proyek ini berdiri di atas jawaban
 * yang bisa diperiksa.
 */

import { useEffect, useState } from "react";
import { IkonHapus, IkonCentang, IkonPeringatan, IkonBaru } from "@/components/Ikon";
import { PemilihTema } from "@/components/PemilihTema";

type Ingatan = { id: string; isi: string; dibuat: number };

export default function HalamanPengaturan() {
  const [instruksi, setInstruksi] = useState("");
  const [tersimpan, setTersimpan] = useState("");
  const [ingatan, setIngatan] = useState<Ingatan[]>([]);
  const [batas, setBatas] = useState(2000);
  const [baru, setBaru] = useState("");
  const [pesan, setPesan] = useState("");
  const [memuat, setMemuat] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    let batal = false;
    fetch("/api/pengaturan")
      .then((r) => r.json())
      .then((d) => {
        if (batal) return;
        setInstruksi(d.instruksi ?? "");
        setTersimpan(d.instruksi ?? "");
        setIngatan(d.ingatan ?? []);
        setBatas(d.batasInstruksi ?? 2000);
        if (d.pesan) setPesan(d.pesan);
      })
      .catch((e) => !batal && setPesan(`Gagal memuat: ${(e as Error).message}`))
      .finally(() => !batal && setMemuat(false));
    return () => {
      batal = true;
    };
  }, []);

  async function simpanInstruksi() {
    setMenyimpan(true);
    try {
      const r = await fetch("/api/pengaturan", {
        method: "PUT",
        body: JSON.stringify({ instruksi }),
      });
      if (!r.ok) throw new Error((await r.json()).pesan ?? `HTTP ${r.status}`);
      setTersimpan(instruksi);
      setPesan("");
    } catch (e) {
      setPesan(`Gagal menyimpan: ${(e as Error).message}`);
    } finally {
      setMenyimpan(false);
    }
  }

  async function tambah() {
    const isi = baru.trim();
    if (!isi) return;
    try {
      const r = await fetch("/api/pengaturan", { method: "POST", body: JSON.stringify({ isi }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.pesan ?? `HTTP ${r.status}`);
      setIngatan((l) => [d, ...l]);
      setBaru("");
      setPesan("");
    } catch (e) {
      setPesan((e as Error).message);
    }
  }

  async function hapus(id: string) {
    const sebelum = ingatan;
    setIngatan((l) => l.filter((i) => i.id !== id));
    try {
      const r = await fetch(`/api/pengaturan?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json()).pesan ?? `HTTP ${r.status}`);
    } catch (e) {
      setIngatan(sebelum);
      setPesan(`Gagal menghapus: ${(e as Error).message}`);
    }
  }

  const berubah = instruksi !== tersimpan;

  return (
    <div className="h-screen overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1
          className="mb-1 text-[30px] leading-tight"
          style={{ color: "var(--teks-utama)", fontFamily: "var(--font-serif)" }}
        >
          Pengaturan
        </h1>
        <p className="mb-8 text-[13px]" style={{ color: "var(--teks-redup)" }}>
          Keduanya di bawah ini masuk ke setiap percakapan, di setiap jalur.
        </p>

        {pesan && (
          <div
            role="alert"
            className="naik mb-6 rounded-[var(--radius)] border px-4 py-3 text-[13px]"
            style={{ borderColor: "var(--warn)", color: "var(--warn)" }}
          >
            <IkonPeringatan ukuran={13} className="mr-1 inline-block align-[-2px]" />
            {pesan}
          </div>
        )}

        {/* Tampilan ditaruh PALING ATAS dan di luar blok `memuat`: ia tidak
            menunggu apa pun dari server -- preferensinya ada di browser --
            jadi menyembunyikannya di balik pemuatan berarti pengguna menatap
            halaman kosong sebelum bisa mengganti sesuatu yang sudah siap. */}
        <section className="mb-10">
          <h2 className="mb-1 text-[15px]" style={{ color: "var(--teks-utama)" }}>
            Tampilan
          </h2>
          <p className="mb-3 text-[12px]" style={{ color: "var(--teks-redup)" }}>
            Disimpan per perangkat, bukan per akun: layar laptop di kamar gelap
            dan layar HP di bawah matahari menuntut jawaban yang berbeda.
          </p>
          <PemilihTema />
        </section>

        {memuat ? (
          <p className="text-[13px]" style={{ color: "var(--teks-redup)" }}>
            Membaca pengaturan…
          </p>
        ) : (
          <>
            <section className="mb-10">
              <h2 className="mb-1 text-[15px]" style={{ color: "var(--teks-utama)" }}>
                Instruksi khusus
              </h2>
              <p className="mb-3 text-[12px]" style={{ color: "var(--teks-redup)" }}>
                Cara kamu ingin dijawab. Contoh: “Selalu tunjukkan kodenya dulu,
                penjelasan setelahnya” atau “Jangan pakai basa-basi pembuka”.
              </p>
              <textarea
                value={instruksi}
                onChange={(e) => setInstruksi(e.target.value.slice(0, batas))}
                rows={6}
                placeholder="Kosongkan kalau tidak perlu."
                aria-label="Instruksi khusus"
                className="w-full resize-y rounded-[var(--radius)] border px-3.5 py-2.5 text-[13px] leading-[1.7] outline-none"
                style={{
                  borderColor: "var(--garis)",
                  background: "var(--lapis-0)",
                  color: "var(--teks-utama)",
                }}
              />
              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={() => void simpanInstruksi()}
                  disabled={!berubah || menyimpan}
                  className="rounded-[var(--radius-kecil)] px-3 py-1.5 text-[12px] transition disabled:opacity-30"
                  style={{ background: "var(--surface)", color: "var(--abyss)" }}
                >
                  {menyimpan ? "menyimpan…" : "Simpan"}
                </button>
                {/* Keadaan tersimpan ditunjukkan lewat tombol yang MATI, bukan
                    lewat pesan sukses yang menghilang sendiri. Tombol mati
                    tetap benar selama tidak ada yang berubah; pesan sekilas
                    hilang tepat saat pengguna melihat ke tempat lain. */}
                {!berubah && !menyimpan && (
                  <span
                    className="flex items-center gap-1.5 text-[11px]"
                    style={{ color: "var(--teks-redup)" }}
                  >
                    <IkonCentang ukuran={11} />
                    tersimpan
                  </span>
                )}
                <span
                  className="angka ml-auto text-[11px]"
                  style={{ color: instruksi.length > batas * 0.9 ? "var(--warn)" : "var(--teks-redup)" }}
                >
                  {instruksi.length}/{batas}
                </span>
              </div>
            </section>

            <section>
              <h2 className="mb-1 text-[15px]" style={{ color: "var(--teks-utama)" }}>
                Ingatan
              </h2>
              <p className="mb-3 text-[12px]" style={{ color: "var(--teks-redup)" }}>
                Fakta tentangmu yang tidak perlu diulang tiap kali. Ditulis
                sendiri, tidak pernah disimpulkan otomatis — ingatan otomatis
                yang salah akan mewarnai setiap jawaban tanpa kamu tahu kenapa.
              </p>

              <div className="mb-4 flex gap-2">
                <input
                  value={baru}
                  onChange={(e) => setBaru(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void tambah()}
                  placeholder="Aku bekerja dengan Next.js dan Python…"
                  aria-label="Ingatan baru"
                  className="min-w-0 flex-1 rounded-[var(--radius)] border px-3.5 py-2 text-[13px] outline-none"
                  style={{
                    borderColor: "var(--garis)",
                    background: "var(--lapis-0)",
                    color: "var(--teks-utama)",
                  }}
                />
                <button
                  onClick={() => void tambah()}
                  disabled={!baru.trim()}
                  aria-label="Tambah ingatan"
                  className="flex shrink-0 items-center gap-1.5 rounded-[var(--radius)] px-3 text-[12px] transition disabled:opacity-30"
                  style={{ background: "var(--lapis-2)", color: "var(--teks-kedua)" }}
                >
                  <IkonBaru ukuran={13} />
                  Tambah
                </button>
              </div>

              {ingatan.length === 0 ? (
                <p className="text-[12px]" style={{ color: "var(--teks-redup)" }}>
                  Belum ada. Tiburon menjawab tanpa mengingat apa pun tentangmu.
                </p>
              ) : (
                <div className="space-y-1">
                  {ingatan.map((i) => (
                    <div
                      key={i.id}
                      className="baris-obrolan flex items-start gap-2 rounded-[var(--radius-kecil)] px-3 py-2 text-[13px]"
                    >
                      <span className="min-w-0 flex-1" style={{ color: "var(--teks-utama)" }}>
                        {i.isi}
                      </span>
                      <button
                        onClick={() => void hapus(i.id)}
                        aria-label={`Hapus ingatan: ${i.isi}`}
                        className="aksi-pesan aksi-obrolan shrink-0 rounded-[var(--radius-kecil)] p-1"
                        style={{ color: "var(--redup)" }}
                      >
                        <IkonHapus ukuran={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
