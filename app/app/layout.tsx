"use client";

/**
 * Kerangka aplikasi Tiburon.
 *
 * Struktur sidebar-nya mengikuti aplikasi Claude desktop, yang jadi rujukan
 * desain awal: toggle mode di paling atas, tombol "Baru" yang menonjol, daftar
 * navigasi berikon, bagian-bagian berjudul dengan aksinya sendiri, daftar
 * percakapan bertanda bulatan, lalu baris akun di paling bawah.
 *
 * Warnanya milik Tiburon — samudra, bukan warm-grey Claude.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarisPercakapan, type Percakapan } from "@/components/BarisPercakapan";
import { DaftarProyek, type Proyek } from "@/components/DaftarProyek";
import { MenuAkun } from "@/components/MenuAkun";
import { MenuUrut, bacaUrutan, urutkan, type Urutan } from "@/components/MenuUrut";
import {
  PenyediaJalurAwal,
  modeDari,
  useJalurAwal,
  type Mode,
} from "@/components/JalurAwal";
import {
  IkonBaru,
  IkonDesain,
  IkonJadwal,
  IkonKode,
  IkonKorpus,
  IkonRadar,
  IkonSumber,
  IkonAtur,
  IkonCari,
  IkonTiburon,
  IkonTutup,
} from "@/components/Ikon";
import "@/styles/tokens.css";

/**
 * Umur ringkas untuk daftar percakapan: 4m, 3j, 6h, 2b.
 *
 * Sengaja sesingkat mungkin -- ini kolom sempit di sisi kanan judul, dan
 * angkanya cuma perlu menjawab "baru atau lama", bukan waktu persis.
 *
 * Dihitung di klien saja. Daftar percakapan dimuat lewat useEffect, jadi
 * server tidak pernah merendernya -- tidak ada risiko waktu server dan klien
 * berbeda lalu memicu galat hidrasi.
 */
function umur(ms: number): string {
  const detik = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (detik < 60) return "kini";
  if (detik < 3600) return `${Math.floor(detik / 60)}m`;
  if (detik < 86400) return `${Math.floor(detik / 3600)}j`;
  if (detik < 2592000) return `${Math.floor(detik / 86400)}h`;
  return `${Math.floor(detik / 2592000)}b`;
}

const NAV = [
  { Ikon: IkonKorpus, label: "Korpus", href: "/app/korpus" },
  { Ikon: IkonRadar, label: "Radar", href: "/app/radar" },
  { Ikon: IkonSumber, label: "Riwayat sumber", href: "/app/sumber" },
  { Ikon: IkonJadwal, label: "Tugas terjadwal", href: "/app/jadwal" },
  { Ikon: IkonDesain, label: "Papan desain", href: "/app/desain" },
  { Ikon: IkonAtur, label: "Pengaturan", href: "/app/pengaturan" },
];

/**
 * Pembungkus penyedia.
 *
 * Jalur awal harus dibaca DUA tempat -- toggle di sidebar yang menyetelnya,
 * dan layar obrolan yang memulai dari sana -- jadi keadaannya duduk di atas
 * keduanya. Menyimpannya di salah satu lalu mengoper lewat prop tidak bisa:
 * layar obrolan datang lewat `children`, bukan dipanggil dari sini.
 */
export default function LayoutAplikasi({ children }: { children: React.ReactNode }) {
  return (
    <PenyediaJalurAwal>
      <Kerangka>{children}</Kerangka>
    </PenyediaJalurAwal>
  );
}

function Kerangka({ children }: { children: React.ReactNode }) {
  const { jalurAwal, setMode } = useJalurAwal();
  const mode = modeDari(jalurAwal);
  const [percakapan, setPercakapan] = useState<Percakapan[]>([]);
  const [galat, setGalat] = useState("");
  const [kueri, setKueri] = useState("");
  const [hasil, setHasil] = useState<Percakapan[] | null>(null);
  const [proyek, setProyek] = useState<Proyek[]>([]);
  // Dibaca di useEffect, bukan saat inisialisasi: localStorage tidak ada di
  // server. Daftar obrolan sendiri juga dimuat di klien, jadi urutan awal
  // yang sesaat salah tidak pernah sempat terlihat.
  const [urutan, setUrutan] = useState<Urutan>("terbaru");
  const jalan = usePathname();
  const router = useRouter();

  useEffect(() => {
    setUrutan(bacaUrutan());
  }, []);

  useEffect(() => {
    fetch("/api/percakapan")
      .then((r) => (r.ok ? r.json() : []))
      .then(setPercakapan)
      .catch(() => setPercakapan([]));
    fetch("/api/proyek")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setProyek(Array.isArray(d) ? d : []))
      .catch(() => setProyek([]));
  }, []);

  async function buatProyek(nama: string) {
    try {
      const r = await fetch("/api/proyek", { method: "POST", body: JSON.stringify({ nama }) });
      // Badan dibaca SEKALI: Response.json() hanya bisa dipanggil sekali per
      // respons, jadi membacanya lagi di dalam setProyek akan melempar.
      const d = await r.json();
      if (!r.ok) throw new Error(d.pesan ?? `HTTP ${r.status}`);
      setProyek((lama) => [d, ...lama]);
      setGalat("");
    } catch (e) {
      setGalat(`Buat proyek gagal: ${(e as Error).message}`);
    }
  }

  /**
   * Pencarian dijalankan di server, bukan disaring di klien.
   *
   * Menyaring `percakapan` di memori hanya bisa mencocokkan JUDUL — isi
   * pesannya tidak pernah ada di klien. Dan justru isi pesan itulah yang
   * biasanya diingat orang saat mencari percakapan lama.
   */
  useEffect(() => {
    const q = kueri.trim();
    if (q.length < 2) {
      setHasil(null);
      return;
    }
    const jeda = window.setTimeout(() => {
      fetch(`/api/percakapan?cari=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then(setHasil)
        .catch(() => setHasil([]));
    }, 200);
    return () => window.clearTimeout(jeda);
  }, [kueri]);

  // `hasil` null berarti tidak sedang mencari; array kosong berarti sedang
  // mencari dan memang tidak ada yang cocok. Keduanya harus dibedakan, karena
  // pesan yang ditampilkan untuk masing-masing berbeda.
  // Hasil pencarian TIDAK diurutkan ulang: yang datang dari server sudah
  // berurut menurut kecocokan, dan mengurutkannya menurut waktu membuang
  // satu-satunya hal yang berguna dari sebuah hasil pencarian.
  const terlihat = hasil ?? urutkan(percakapan, urutan);

  /**
   * Ganti nama dan hapus, keduanya OPTIMISTIS: daftar diperbarui lebih dulu,
   * lalu server dihubungi.
   *
   * Alasannya bukan kecepatan — basis datanya lokal dan balasannya datang
   * dalam hitungan milidetik. Alasannya adalah menunggu balasan untuk sesuatu
   * yang PASTI berhasil membuat antarmuka terasa ragu-ragu.
   *
   * Karena itu, gagalnya harus benar-benar dipulihkan, bukan didiamkan:
   * keadaan sebelumnya disimpan dan dikembalikan persis, lalu alasannya
   * ditampilkan. Antarmuka optimistis yang tidak memulihkan diri saat gagal
   * adalah antarmuka yang berbohong.
   */
  async function gantiNama(id: string, judul: string) {
    const sebelum = percakapan;
    setPercakapan((d) => d.map((p) => (p.id === id ? { ...p, judul } : p)));
    try {
      const r = await fetch("/api/percakapan", {
        method: "PATCH",
        body: JSON.stringify({ id, judul }),
      });
      if (!r.ok) throw new Error((await r.json()).pesan ?? `HTTP ${r.status}`);
      setGalat("");
    } catch (e) {
      setPercakapan(sebelum);
      setGalat(`Ganti nama gagal: ${(e as Error).message}`);
    }
  }

  async function semat(id: string, disemat: boolean) {
    const sebelum = percakapan;
    // TIDAK diurutkan ulang di sini. Urutannya diturunkan dari state saat
    // render lewat urutkan(), jadi menandai tersemat sudah cukup untuk
    // memindahkan barisnya ke atas. Mengurutkan lagi di sini justru salah:
    // aturannya dulu dipatok "disemat lalu waktu", dan itu akan melawan
    // pilihan "Judul A-Z".
    setPercakapan((d) => d.map((p) => (p.id === id ? { ...p, disemat } : p)));
    try {
      const r = await fetch("/api/percakapan", {
        method: "PATCH",
        body: JSON.stringify({ id, disemat }),
      });
      if (!r.ok) throw new Error((await r.json()).pesan ?? `HTTP ${r.status}`);
      setGalat("");
    } catch (e) {
      setPercakapan(sebelum);
      setGalat(`Sematkan gagal: ${(e as Error).message}`);
    }
  }

  async function hapus(id: string) {
    const sebelum = percakapan;
    setPercakapan((d) => d.filter((p) => p.id !== id));
    try {
      const r = await fetch(`/api/percakapan?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json()).pesan ?? `HTTP ${r.status}`);
      setGalat("");
    } catch (e) {
      setPercakapan(sebelum);
      setGalat(`Hapus gagal: ${(e as Error).message}`);
    }
  }

  return (
    <div className="flex h-screen" style={{ background: "var(--lapis-0)" }}>
      <aside
        className="flex w-[300px] shrink-0 flex-col border-r"
        style={{
          borderColor: "var(--garis)",
          // Sidebar duduk SATU tingkat di atas kanvas, dan kabut yang sama
          // dilapiskan di atasnya supaya bagian bawahnya menggelap seperti
          // sisa layar. Tanpa itu ia terlihat seperti panel yang ditempel,
          // bukan bagian dari air yang sama.
          backgroundColor: "var(--lapis-1)",
          backgroundImage: "var(--kabut-dalam)",
        }}
      >
        {/* Toggle mode -- pill tersegmen di paling atas.

            Menyetel jalur AWAL obrolan baru, bukan mengunci apa pun: pemilih
            jalur di komposer tetap berkuasa per pesan. Judulnya menyebutkan
            itu, karena toggle sebesar ini di tempat sepenting ini akan
            ditebak orang sebagai sakelar yang mengunci. */}
        <div className="p-3">
          <div
            className="flex rounded-[var(--radius)] p-0.5"
            style={{ background: "var(--abyss)" }}
          >
            {(["obrolan", "kode"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                title={
                  m === "obrolan"
                    ? "Obrolan baru mulai di jalur Cepat"
                    : "Obrolan baru mulai di jalur Kode"
                }
                className="flex-1 rounded-[var(--radius-kecil)] px-3 py-1.5 text-[13px] transition"
                style={
                  mode === m
                    ? { background: "var(--ocean)", color: "var(--shell)" }
                    : { color: "var(--redup)" }
                }
              >
                <span className="flex items-center justify-center gap-1.5">
                  {m === "obrolan" ? <IkonTiburon ukuran={14} /> : <IkonKode ukuran={14} />}
                  {m === "obrolan" ? "Obrolan" : "Kode"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tombol Baru */}
        <div className="px-3 pb-2">
          <Link
            href="/app"
            className="tombol-baru flex items-center gap-2.5 rounded-[var(--radius)] px-3 py-2 text-[14px]"
            style={{ background: "var(--hover)", color: "var(--shell)" }}
          >
            <IkonBaru ukuran={16} className="ikon-kail" />
            Obrolan baru
          </Link>
        </div>

        {/* Navigasi berikon */}
        <nav className="px-3 pb-3">
          {NAV.map((n) => {
            const aktif = jalan === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={aktif ? "page" : undefined}
                className="baris-nav relative flex items-center gap-3 rounded-[var(--radius)] py-2 pl-4 pr-3 text-[14px]"
                style={{ color: aktif ? "var(--foam)" : "var(--shell)" }}
              >
                {/* Rel kiri: penanda halaman aktif. Ia tumbuh dari tengah ke
                    atas dan bawah, bukan muncul begitu saja -- gerakan yang
                    sama seperti penanda gigi hiu di pemilih jalur. */}
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 w-[2px] -translate-y-1/2 rounded-full"
                  style={{
                    height: aktif ? "18px" : "0px",
                    background: "var(--surface)",
                    boxShadow: aktif ? "var(--pendar)" : "none",
                    transition: "height 200ms var(--keluar)",
                  }}
                />
                <n.Ikon
                  ukuran={17}
                  className={aktif ? "ikon-aktif" : undefined}
                />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <DaftarProyek proyek={proyek} onBuat={(n) => void buatProyek(n)} />

        {/* Daftar percakapan */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3">
          <div
            className="flex items-center justify-between px-3 pb-1 pt-3 text-[12px]"
            style={{ color: "var(--redup)" }}
          >
            <span>Obrolan</span>
            <MenuUrut urutan={urutan} onGanti={setUrutan} />
          </div>

          {/* Pencarian mencari di JUDUL DAN ISI PESAN. Mencari judul saja
              hampir tidak pernah menolong: yang diingat orang biasanya
              kalimat di dalam percakapan, bukan judul yang dibuat otomatis. */}
          <div className="relative mb-1 px-1">
            <span
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
              style={{ color: "var(--redup)" }}
            >
              <IkonCari ukuran={13} />
            </span>
            <input
              value={kueri}
              onChange={(e) => setKueri(e.target.value)}
              placeholder="Cari obrolan…"
              aria-label="Cari obrolan"
              className="w-full rounded-[var(--radius-kecil)] border py-1.5 pl-9 pr-7 text-[12px] outline-none"
              style={{
                borderColor: "var(--garis)",
                background: "var(--lapis-0)",
                color: "var(--teks-utama)",
              }}
            />
            {kueri && (
              <button
                onClick={() => setKueri("")}
                aria-label="Bersihkan pencarian"
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--redup)" }}
              >
                <IkonTutup ukuran={11} />
              </button>
            )}
          </div>

          {terlihat.length === 0 ? (
            <p className="px-3 py-2 text-[12px]" style={{ color: "var(--redup)" }}>
              {kueri.trim().length >= 2
                ? `Tidak ada obrolan yang memuat “${kueri.trim()}”.`
                : "Belum ada obrolan. Mulai dari kotak di sebelah."}
            </p>
          ) : (
            terlihat.map((p, i) => (
              // Titik hangat pada yang teratas, cincin dingin pada sisanya --
              // menjawab "mana yang terakhir kusentuh" tanpa membaca satu kata.
              <BarisPercakapan
                key={p.id}
                percakapan={p}
                terbaru={i === 0}
                umur={umur(p.diperbarui)}
                onBuka={() => router.push(`/app?id=${p.id}`)}
                onGantiNama={(judul) => void gantiNama(p.id, judul)}
                onHapus={() => void hapus(p.id)}
                onSemat={(disemat) => void semat(p.id, disemat)}
              />
            ))
          )}
        </div>

        {/* Galat dari aksi optimistis. Ditaruh tepat di atas baris akun, di
            dalam sidebar: yang gagal ada di sidebar, jadi kabarnya juga. */}
        {galat && (
          <div
            role="alert"
            className="naik mx-3 mb-2 rounded-[var(--radius-kecil)] border px-2.5 py-1.5 text-[11px]"
            style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
          >
            {galat}
          </div>
        )}

        <MenuAkun />
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
