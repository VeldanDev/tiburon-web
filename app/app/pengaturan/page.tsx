"use client";

/**
 * Pengaturan: satu rel bagian di kiri, satu bagian terbuka di kanan.
 *
 * Sebelumnya semua ini satu kolom panjang. Itu masih terbaca saat isinya dua
 * bagian, tapi berhenti terbaca begitu bagiannya lima: ingatan — hal yang
 * paling sering disunting — terdorong ke bawah lipatan, dan tidak ada cara
 * menautkan langsung ke satu bagian.
 *
 * Rel kirinya menyelesaikan keduanya sekaligus. Bagian aktif ada di URL
 * (`?bagian=ingatan`), jadi menu akun bisa membuka tepat satu bagian, dan
 * memuat ulang halaman tidak melempar orang kembali ke atas.
 */

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IkonAtur,
  IkonBaru,
  IkonCentang,
  IkonHapus,
  IkonLayar,
  IkonPelampung,
  IkonPeringatan,
  IkonPintasan,
  IkonSunting,
  IkonTiburon,
} from "@/components/Ikon";
import { PemilihTema } from "@/components/PemilihTema";
import { PINTASAN } from "@/components/chat/PanelPintasan";
import { RANTAI_BAWAAN } from "@/lib/penyedia";
import { jalurBagian, sahihBagian, type IdBagian } from "@/lib/bagian-pengaturan";

type Ingatan = { id: string; isi: string; dibuat: number };

const BAGIAN: {
  id: IdBagian;
  label: string;
  Ikon: (p: { ukuran?: number }) => React.ReactElement;
}[] = [
  { id: "tampilan", label: "Tampilan", Ikon: IkonLayar },
  { id: "instruksi", label: "Instruksi khusus", Ikon: IkonSunting },
  { id: "ingatan", label: "Ingatan", Ikon: IkonPelampung },
  { id: "pintasan", label: "Pintasan", Ikon: IkonPintasan },
  { id: "tentang", label: "Tentang", Ikon: IkonTiburon },
];

/** Judul + satu kalimat alasan. Tiap bagian dibuka dengan bentuk yang sama. */
function Kepala({ judul, alasan }: { judul: string; alasan: string }) {
  return (
    <header className="mb-5">
      <h2
        className="text-[22px] leading-tight"
        style={{ color: "var(--teks-utama)", fontFamily: "var(--font-serif)" }}
      >
        {judul}
      </h2>
      <p className="mt-1 text-[12.5px] leading-[1.7]" style={{ color: "var(--teks-redup)" }}>
        {alasan}
      </p>
    </header>
  );
}

const TENTANG: { k: string; v: string }[] = [
  {
    k: "Riwayat percakapan",
    v: "data/riwayat.sqlite di folder proyek. Satu berkas; menyalinnya berarti menyalin seluruh riwayatmu.",
  },
  {
    k: "Korpus",
    v: "Dibuka hanya-baca, selalu. Tiburon bisa mencari di dalamnya, tapi tidak punya jalan untuk mengubahnya.",
  },
  {
    k: "Kunci API",
    v: "Hanya ada di server, di .env.local yang tidak pernah ikut ke Git. Browser tidak pernah menerimanya.",
  },
  {
    k: "Urutan model",
    v: `${RANTAI_BAWAAN.join(" → ")}. Yang berikutnya dicoba kalau yang sebelumnya gagal.`,
  },
  {
    k: "Ingatan otomatis",
    v: "Tidak ada. Setiap baris ingatan ditulis olehmu di bagian Ingatan, dan bisa dihapus dari sana.",
  },
];

function IsiPengaturan() {
  const router = useRouter();
  const parameter = useSearchParams();
  const bagian = sahihBagian(parameter.get("bagian"));

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

  // replace, bukan push: lima bagian di halaman yang sama bukan lima halaman.
  // Kalau tiap klik menumpuk riwayat, tombol Kembali harus ditekan lima kali
  // untuk keluar dari pengaturan.
  function pindah(id: IdBagian) {
    router.replace(jalurBagian(id), { scroll: false });
  }

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

  const sedangMemuat = (
    <p className="text-[13px]" style={{ color: "var(--teks-redup)" }}>
      Membaca pengaturan…
    </p>
  );

  return (
    <div className="mx-auto flex h-screen w-full max-w-4xl gap-8 px-6 py-10 md:gap-12 md:px-10">
      {/* Rel bagian. Di layar sempit ia jadi baris ikon di atas isinya, bukan
          kolom yang memakan setengah lebar. */}
      <nav aria-label="Bagian pengaturan" className="hidden w-[190px] shrink-0 flex-col md:flex">
        <div className="mb-4 flex items-center gap-2 px-3">
          <IkonAtur ukuran={15} />
          <span className="text-[12px]" style={{ color: "var(--teks-redup)" }}>
            Pengaturan
          </span>
        </div>
        {BAGIAN.map((b) => {
          const aktif = b.id === bagian;
          return (
            <button
              key={b.id}
              onClick={() => pindah(b.id)}
              aria-current={aktif ? "page" : undefined}
              className="baris-nav relative flex items-center gap-2.5 rounded-[var(--radius)] py-2 pl-4 pr-3 text-left text-[13.5px]"
              style={{ color: aktif ? "var(--foam)" : "var(--teks-kedua)" }}
            >
              {/* Rel kiri yang sama seperti navigasi sidebar: tumbuh dari
                  tengah ke atas dan bawah, bukan muncul begitu saja. */}
              <span
                aria-hidden
                className="absolute left-0 top-1/2 w-[2px] -translate-y-1/2 rounded-full"
                style={{
                  height: aktif ? "16px" : "0px",
                  background: "var(--surface)",
                  boxShadow: aktif ? "var(--pendar)" : "none",
                  transition: "height 200ms var(--keluar)",
                }}
              />
              <b.Ikon ukuran={15} />
              {b.label}
            </button>
          );
        })}
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto pb-16">
        {/* Versi sempit dari rel: sekrol mendatar, ikon dan label sama. */}
        <div
          className="mb-6 flex gap-1 overflow-x-auto border-b pb-3 md:hidden"
          role="tablist"
          aria-label="Bagian pengaturan"
          style={{ borderColor: "var(--garis)" }}
        >
          {BAGIAN.map((b) => (
            <button
              key={b.id}
              onClick={() => pindah(b.id)}
              role="tab"
              aria-selected={b.id === bagian}
              className="flex shrink-0 items-center gap-1.5 rounded-[var(--radius-kecil)] px-2.5 py-1.5 text-[12.5px] transition"
              style={
                b.id === bagian
                  ? { background: "var(--lapis-2)", color: "var(--foam)" }
                  : { color: "var(--teks-redup)" }
              }
            >
              <b.Ikon ukuran={14} />
              {b.label}
            </button>
          ))}
        </div>

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

        {bagian === "tampilan" && (
          <section>
            <Kepala
              judul="Tampilan"
              alasan="Disimpan per perangkat, bukan per akun: layar laptop di kamar gelap dan layar HP di bawah matahari menuntut jawaban yang berbeda."
            />
            <div className="flex items-center justify-between gap-4">
              <span className="text-[13px]" style={{ color: "var(--teks-utama)" }}>
                Tema
              </span>
              <PemilihTema />
            </div>
            <p
              className="mt-4 border-t pt-4 text-[12px] leading-[1.8]"
              style={{ borderColor: "var(--garis)", color: "var(--teks-redup)" }}
            >
              Gerak mengikuti setelan sistemmu. Kalau &ldquo;kurangi gerak&rdquo; menyala di
              perangkat ini, salju laut dan sapuan sonar berhenti sendiri — tidak ada
              sakelar terpisah yang bisa lupa disetel.
            </p>
          </section>
        )}

        {bagian === "instruksi" &&
          (memuat ? (
            sedangMemuat
          ) : (
            <section>
              <Kepala
                judul="Instruksi khusus"
                alasan="Cara kamu ingin dijawab, dibaca di setiap percakapan dan di setiap jalur. Misalnya: selalu tunjukkan kodenya dulu, penjelasan setelahnya."
              />
              <textarea
                value={instruksi}
                onChange={(e) => setInstruksi(e.target.value.slice(0, batas))}
                rows={8}
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
                  style={{
                    color: instruksi.length > batas * 0.9 ? "var(--warn)" : "var(--teks-redup)",
                  }}
                >
                  {instruksi.length}/{batas}
                </span>
              </div>
              <p
                className="mt-6 border-t pt-4 text-[12px] leading-[1.8]"
                style={{ borderColor: "var(--garis)", color: "var(--teks-redup)" }}
              >
                Dibaca di server, tidak pernah dikirim dari browser. Kalau browser yang
                memasok isi prompt sistem, siapa pun yang bisa memanggil rutenya bisa
                menyisipkan apa pun ke dalamnya.
              </p>
            </section>
          ))}

        {bagian === "ingatan" &&
          (memuat ? (
            sedangMemuat
          ) : (
            <section>
              <Kepala
                judul="Ingatan"
                alasan="Fakta tentangmu yang tidak perlu diulang tiap kali. Ditulis sendiri, tidak pernah disimpulkan otomatis — ingatan otomatis yang salah akan mewarnai setiap jawaban tanpa kamu tahu kenapa."
              />

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
          ))}

        {bagian === "pintasan" && (
          <section>
            <Kepala
              judul="Pintasan papan ketik"
              alasan="Daftar yang sama yang muncul saat kamu menekan tanda tanya, dibangun dari satu sumber data dengan pendengarnya — jadi ia tidak bisa perlahan menyebut pintasan yang sudah dihapus."
            />
            <div
              className="overflow-hidden rounded-[var(--radius)] border"
              style={{ borderColor: "var(--garis)" }}
            >
              {PINTASAN.map((p, i) => (
                <div
                  key={p.arti}
                  className={`flex items-center justify-between gap-4 px-3.5 py-2.5 text-[13px] ${
                    i > 0 ? "border-t" : ""
                  }`}
                  style={{ borderColor: "var(--garis)" }}
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
          </section>
        )}

        {bagian === "tentang" && (
          <section>
            <Kepala
              judul="Tentang Tiburon"
              alasan="Apa yang berjalan di mana. Bagian ini ada supaya tidak ada yang harus membaca kode untuk tahu di mana datanya disimpan."
            />
            <dl className="text-[13px]">
              {TENTANG.map((b) => (
                <div
                  key={b.k}
                  className="flex flex-col gap-1 border-b py-3 sm:flex-row sm:gap-6"
                  style={{ borderColor: "var(--garis)" }}
                >
                  <dt className="shrink-0 sm:w-[150px]" style={{ color: "var(--teks-kedua)" }}>
                    {b.k}
                  </dt>
                  <dd className="min-w-0 leading-[1.7]" style={{ color: "var(--teks-redup)" }}>
                    {b.v}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    </div>
  );
}

export default function HalamanPengaturan() {
  return (
    // useSearchParams menuntut batas Suspense di halaman yang dipraredner
    // statis. Cadangannya sengaja sunyi: halaman ini terbaca dalam sekejap dari
    // berkas lokal, dan kerangka berkedip lebih mengganggu daripada jeda.
    <Suspense fallback={null}>
      <IsiPengaturan />
    </Suspense>
  );
}
