"use client";

/**
 * Layar chat Tiburon.
 *
 * Bahasa visualnya mengambil yang terbaik dari aplikasi chat yang sudah matang:
 *
 *   ChatGPT    kolom pesan sempit dan terpusat (~48rem) — baris teks yang
 *              terlalu lebar melelahkan mata; ini yang membuatnya enak dibaca
 *              berjam-jam.
 *   Claude.ai  pesan asisten tanpa gelembung, mengalir seperti dokumen; hanya
 *              pesan pengguna yang diberi gelembung. Bacaan panjang jadi
 *              terasa seperti tulisan, bukan seperti chat aplikasi pesan.
 *   Grok       bilah status tipis di atas — konteks terpakai, jalur aktif.
 *   Claude Code komposer membulat dengan pemilih di dalamnya, bukan di luar.
 *
 * Komponen `brainless` (tool call, diff, izin) TIDAK dipakai di sini — itu
 * bahasa agent coding di terminal, dan tempatnya nanti di jalur ⌘ Kode.
 */

import { useEffect, useRef, useState } from "react";
import { PemilihJalur, type Jalur } from "@/components/chat/PemilihJalur";
import { PengukurKedalaman } from "@/components/chat/PengukurKedalaman";
import { SaljuLaut } from "@/components/chat/SaljuLaut";
import { Sonar } from "@/components/chat/Sonar";
import { SpandukKuota } from "@/components/chat/SpandukKuota";
import { MenuPerintah, PERINTAH, type Perintah } from "@/components/chat/MenuPerintah";
import { KartuSumber } from "@/components/chat/KartuSumber";
import { HitunganKorpus } from "@/components/chat/HitunganKorpus";
import { Markdown } from "@/components/chat/Markdown";
import { AksiPesan } from "@/components/chat/AksiPesan";
import { TandaTiburon } from "@/components/TandaTiburon";
import {
  IkonBanding,
  IkonCepat,
  IkonModel,
  IkonPeringatan,
  IkonRadar,
  IkonTiburon,
} from "@/components/Ikon";
import { useRouter } from "next/navigation";

type KejadianAliran =
  | { jenis: "model"; nama: string }
  | { jenis: "teks"; teks: string }
  | { jenis: "sumber"; berkas: string[] }
  | { jenis: "peringatan"; pesan: string }
  | { jenis: "gagal"; pesan: string }
  | { jenis: "selesai" };

type Balasan = {
  peran: "user" | "assistant";
  isi: string;
  model?: string;
  sumber?: string[];
  peringatan?: string;
  /** Pertanyaan yang memicu balasan ini -- dipakai kartu sumber untuk
   *  mengambil potongan yang sama dan menyorot kata yang cocok. */
  kueri?: string;
  /** Diisi hanya saat mode banding: jalur mana yang menghasilkan balasan ini.
   *  Dua balasan berurutan yang punya kolom akan dirender berdampingan. */
  kolom?: Jalur;
};

function bacaKejadian(baris: string): KejadianAliran | null {
  try {
    const k: unknown = JSON.parse(baris);
    if (typeof k === "object" && k !== null && "jenis" in k) return k as KejadianAliran;
  } catch {
    // potongan SSE belum utuh — lewati
  }
  return null;
}

export default function HalamanObrolan() {
  const [jalur, setJalur] = useState<Jalur>("cepat");
  const [pesan, setPesan] = useState<Balasan[]>([]);
  const [teks, setTeks] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [idPercakapan, setIdPercakapan] = useState<string | null>(null);
  const [galatRiwayat, setGalatRiwayat] = useState("");
  const [mencariKorpus, setMencariKorpus] = useState(false);
  const [kuotaHabis, setKuotaHabis] = useState("");
  const [banding, setBanding] = useState(false);
  const [ringkasKorpus, setRingkasKorpus] = useState<{
    berkas: number;
    potongan: number;
  } | null>(null);
  const bawah = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Menu perintah muncul saat kotak diawali "/" dan belum ada spasi.
  const menuTerbuka = teks.startsWith("/") && !teks.includes(" ");

  useEffect(() => {
    // Dipanggil opsional: scrollIntoView tidak ada di semua lingkungan
    // (jsdom tidak punya). Tanpa `?.` seluruh komponen gagal render di uji.
    bawah.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [pesan]);

  // Pintasan kedalaman: Ctrl/Cmd + 1, 2, 3.
  //
  // Sengaja TANPA animasi pemicu apa pun -- aksi yang dijalankan lewat papan
  // ketik dipakai puluhan kali sehari, dan animasi di sana jadi hambatan.
  // Pengukur kedalaman di tepi tetap berpindah 180ms; itu sudah cukup jadi
  // umpan balik.
  useEffect(() => {
    function tekan(e: KeyboardEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      const peta: Record<string, Jalur> = { "1": "cepat", "2": "tiburon", "3": "kode" };
      const tujuan = peta[e.key];
      if (!tujuan) return;
      e.preventDefault();
      setJalur(tujuan);
    }
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, []);

  // Ringkasan korpus untuk kartu "Korpus aktif" di layar kosong. Gagalnya
  // dibiarkan diam: kartu itu keterangan tambahan, dan memunculkan spanduk
  // galat untuknya akan menutupi layar pembuka hanya karena hiasan gagal.
  useEffect(() => {
    let dibatalkan = false;
    fetch("/api/korpus/berkas")
      .then((r) => r.json())
      .then((d) => {
        if (dibatalkan || !Array.isArray(d.berkas)) return;
        setRingkasKorpus({ berkas: d.berkas.length, potongan: d.totalPotongan ?? 0 });
      })
      .catch(() => {});
    return () => {
      dibatalkan = true;
    };
  }, []);

  useEffect(() => {
    let dibatalkan = false;
    (async () => {
      try {
        const r = await fetch("/api/percakapan");
        if (!r.ok) throw new Error(`daftar percakapan: HTTP ${r.status}`);
        const daftar: { id: string }[] = await r.json();
        if (dibatalkan || !daftar.length) return;
        const id = daftar[0].id;
        const rp = await fetch(`/api/percakapan?id=${id}`);
        if (!rp.ok) throw new Error(`isi percakapan: HTTP ${rp.status}`);
        const lama: { role: string; content: string }[] = await rp.json();
        if (dibatalkan) return;
        setIdPercakapan(id);
        setPesan(lama.map((p) => ({ peran: p.role as "user" | "assistant", isi: p.content })));
      } catch (e) {
        if (!dibatalkan) {
          setGalatRiwayat(
            `Riwayat gagal dimuat: ${(e as Error).message}. ` +
              `Percakapan lamamu masih tersimpan — muat ulang untuk mencoba lagi.`,
          );
        }
      }
    })();
    return () => {
      dibatalkan = true;
    };
  }, []);

  async function pastikanPercakapan(judul: string): Promise<string | null> {
    if (idPercakapan) return idPercakapan;
    try {
      const r = await fetch("/api/percakapan", {
        method: "POST",
        body: JSON.stringify({ judul: judul.slice(0, 60) }),
      });
      if (!r.ok) return null;
      const { id } = await r.json();
      setIdPercakapan(id);
      return id;
    } catch {
      return null;
    }
  }

  function simpan(id: string | null, role: "user" | "assistant", content: string) {
    if (!id) return;
    void fetch("/api/percakapan", {
      method: "PUT",
      body: JSON.stringify({ id, pesan: { role, content } }),
    }).catch(() => {});
  }

  function jalankanPerintah(cmd: Perintah) {
    if (cmd.tuju) {
      router.push(cmd.tuju);
      setTeks("");
      return;
    }
    if (cmd.jalur) setJalur(cmd.jalur);
    setTeks(cmd.isi ?? "");
  }

  /**
   * Membaca satu aliran SSE dan menuliskannya ke pesan pada indeks tertentu.
   *
   * Dipisah dari kirim() supaya mode banding bisa menjalankan DUA aliran
   * bersamaan, masing-masing menulis ke kolomnya sendiri tanpa saling
   * menimpa. Indeks dipakai, bukan "pesan terakhir", justru karena saat
   * banding ada dua pesan terakhir.
   */
  async function alirkan(jalurDipakai: Jalur, indeks: number, riwayat: Balasan[]) {
    const tulis = (ubah: (b: Balasan) => void) =>
      setPesan((lama) => {
        const salin = [...lama];
        if (!salin[indeks]) return lama;
        salin[indeks] = { ...salin[indeks] };
        ubah(salin[indeks]);
        return salin;
      });

    try {
      const resp = await fetch("/api/cepat", {
        method: "POST",
        body: JSON.stringify({
          jalur: jalurDipakai,
          pesan: riwayat.map((p) => ({ role: p.peran, content: p.isi })),
        }),
      });
      if (!resp.ok || !resp.body) {
        throw new Error(`Server membalas ${resp.status}${resp.body ? "" : " tanpa isi"}`);
      }

      const pembaca = resp.body.getReader();
      const dekoder = new TextDecoder();
      let sisa = "";
      for (;;) {
        const { done, value } = await pembaca.read();
        if (done) break;
        sisa += dekoder.decode(value, { stream: true });
        const baris = sisa.split("\n");
        sisa = baris.pop() ?? "";
        for (const b of baris) {
          if (!b.startsWith("data: ")) continue;
          const k = bacaKejadian(b.slice(6));
          if (!k) continue;
          if (k.jenis === "sumber" || k.jenis === "peringatan") matikanSonar();
          if (k.jenis === "sumber" && k.berkas.length > 0) {
            // Dicatat supaya halaman Riwayat sumber bisa menjawab
            // berkas mana yang benar-benar terpakai. Gagal mencatat
            // tidak boleh mengganggu jawaban yang sedang mengalir.
            void fetch("/api/sumber", {
              method: "POST",
              body: JSON.stringify({
                berkas: k.berkas,
                kueri: riwayat[riwayat.length - 1]?.isi ?? "",
              }),
            }).catch(() => {});
          }
          if (k.jenis === "gagal" && /semua model gagal/i.test(k.pesan)) {
            setKuotaHabis(k.pesan);
          }
          tulis((akhir) => {
            if (k.jenis === "teks") akhir.isi += k.teks;
            if (k.jenis === "model") akhir.model = k.nama;
            if (k.jenis === "sumber") akhir.sumber = k.berkas;
            if (k.jenis === "peringatan") akhir.peringatan = k.pesan;
            if (k.jenis === "gagal") {
              // Ditulis sebagai teks tebal markdown, bukan karakter simbol:
              // isi pesan sekarang dirender lewat <Markdown>, dan simbol
              // Unicode bentuknya berubah-ubah tergantung sistem operasi.
              akhir.isi = akhir.isi
                ? `${akhir.isi}\n\n**Gagal:** ${k.pesan}`
                : `**Gagal:** ${k.pesan}`;
            }
          });
        }
      }
    } catch (e) {
      tulis((akhir) => {
        akhir.isi = akhir.isi
          ? `${akhir.isi}\n\n**Terputus:** ${(e as Error).message}`
          : `**Gagal menghubungi server:** ${(e as Error).message}`;
      });
    }
  }

  let bolehMatikanSonar = true;
  const matikanSonar = () => {
    if (bolehMatikanSonar) setMencariKorpus(false);
    else window.setTimeout(() => setMencariKorpus(false), 700);
  };

  async function kirim() {
    if (!teks.trim() || sibuk) return;
    const dikirim = teks;
    setTeks("");
    await jalankan(dikirim, [...pesan, { peran: "user", isi: dikirim }]);
  }

  /**
   * Ulangi jawaban terakhir.
   *
   * Pertanyaannya dikirim ulang persis seperti semula, dan jawaban lama
   * DIBUANG, bukan ditambahkan di bawahnya. Menumpuk dua jawaban untuk satu
   * pertanyaan membuat riwayat sulit dibaca dan membuat "ulangi" terasa
   * seperti "tanya lagi" — dua hal yang berbeda.
   */
  async function ulangi() {
    if (sibuk) return;
    const iPengguna = pesan.findLastIndex((p) => p.peran === "user");
    if (iPengguna === -1) return;
    await jalankan(pesan[iPengguna].isi, pesan.slice(0, iPengguna + 1));
  }

  /**
   * Inti pengiriman, dipakai bersama oleh `kirim` dan `ulangi`.
   *
   * `riwayat` sudah harus berakhir pada pesan pengguna yang mau dijawab —
   * itulah satu-satunya perbedaan antara mengirim baru dan mengulang.
   */
  async function jalankan(dikirim: string, riwayat: Balasan[]) {
    // Mode banding menaruh DUA balasan kosong sekaligus, satu per kolom.
    const barisBaru: Balasan[] = banding
      ? [
          { peran: "assistant", isi: "", kueri: dikirim, kolom: "cepat" },
          { peran: "assistant", isi: "", kueri: dikirim, kolom: "tiburon" },
        ]
      : [{ peran: "assistant", isi: "", kueri: dikirim }];

    setPesan([...riwayat, ...barisBaru]);
    setSibuk(true);

    // Sonar hanya berdenyut kalau ada jalur yang benar-benar mencari korpus.
    bolehMatikanSonar = true;
    if (banding || jalur === "tiburon") {
      setMencariKorpus(true);
      bolehMatikanSonar = false;
      window.setTimeout(() => {
        bolehMatikanSonar = true;
      }, 700);
    }

    const id = await pastikanPercakapan(dikirim);
    simpan(id, "user", dikirim);

    const awal = riwayat.length;
    try {
      if (banding) {
        // Dua aliran berjalan BERSAMAAN, bukan berurutan. Perbandingannya
        // kehilangan maknanya kalau satu sisi harus menunggu sisi lain.
        await Promise.all([
          alirkan("cepat", awal, riwayat),
          alirkan("tiburon", awal + 1, riwayat),
        ]);
      } else {
        await alirkan(jalur, awal, riwayat);
      }

      setPesan((lama) => {
        const isi = lama
          .slice(awal)
          .map((b) => (b.kolom ? `[${b.kolom}] ${b.isi}` : b.isi))
          .filter(Boolean)
          .join("\n\n");
        if (isi) simpan(id, "assistant", isi);
        return lama;
      });
    } finally {
      setSibuk(false);
      matikanSonar();
    }
  }

  const kosong = pesan.length === 0;

  /**
   * Pesan datar dikelompokkan untuk render.
   *
   * Dua balasan asisten berurutan yang punya `kolom` berasal dari satu
   * pertanyaan yang dibandingkan, jadi keduanya dirender berdampingan.
   */
  type Kelompok =
    | { jenis: "pengguna"; isi: string }
    | { jenis: "tunggal"; balasan: Balasan[] }
    | { jenis: "banding"; balasan: Balasan[] };

  const kelompok: Kelompok[] = [];
  for (let i = 0; i < pesan.length; i++) {
    const p = pesan[i];
    if (p.peran === "user") {
      kelompok.push({ jenis: "pengguna", isi: p.isi });
      continue;
    }
    const berikut = pesan[i + 1];
    if (p.kolom && berikut?.kolom && berikut.peran === "assistant") {
      kelompok.push({ jenis: "banding", balasan: [p, berikut] });
      i++;
      continue;
    }
    kelompok.push({ jenis: "tunggal", balasan: [p] });
  }

  function isiBalasan(p: Balasan, kunci: number) {
    return (
      <div key={kunci} className="space-y-2">
        {p.peringatan && (
          <div className="text-[12px]" style={{ color: "var(--warn)" }}>
            <IkonPeringatan ukuran={13} className="mr-1 inline-block align-[-2px]" />
            {p.peringatan}
          </div>
        )}
        {(p.model || p.sumber?.length) && (
          <div className="flex flex-col gap-2 text-[11px] sm:flex-row sm:flex-wrap sm:items-start">
            {p.model && (
              <span
                className="rounded-[var(--radius-kecil)] px-2 py-0.5"
                style={{ background: "var(--hover)", color: "var(--redup)" }}
              >
                <IkonModel ukuran={11} className="mr-1 inline-block align-[-1px]" />
                {p.model}
              </span>
            )}
            {p.sumber?.map((b, j) => (
              <span key={b} style={{ animationDelay: `${j * 40}ms` }}>
                <KartuSumber berkas={b} kueri={p.kueri ?? ""} />
              </span>
            ))}
          </div>
        )}
        <div className="text-[15px] leading-[1.75]" style={{ color: "var(--teks-utama)" }}>
          <Markdown isi={p.isi} />
          {sibuk && !p.isi && (
            <span
              className="kursor ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px]"
              style={{ background: "var(--surface)" }}
            />
          )}
        </div>
        {/* Aksi hanya muncul pada jawaban yang sudah selesai: menyalin atau
            mengulang jawaban yang masih setengah jalan tidak pernah berguna. */}
        {p.isi && !sibuk && <AksiPesan isi={p.isi} onUlangi={() => ulangi()} />}
      </div>
    );
  }


  const komposer = (
    <div className="w-full">
      {menuTerbuka && <MenuPerintah kueri={teks} onPilih={jalankanPerintah} />}
      <div
        className="w-full rounded-[var(--radius-besar)] border p-2 transition"
        style={{
          borderColor: "var(--garis)",
          background: "var(--abyss)",
          boxShadow: sibuk ? "var(--pendar)" : undefined,
        }}
      >
      <textarea
        value={teks}
        onChange={(e) => setTeks(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            // Saat menu perintah terbuka, Enter memilih yang pertama cocok
            // alih-alih mengirim "/korpus" sebagai pertanyaan.
            if (menuTerbuka) {
              const cocok = PERINTAH.find((c) => c.kunci.startsWith(teks.toLowerCase()));
              if (cocok) {
                jalankanPerintah(cocok);
                return;
              }
            }
            void kirim();
          }
        }}
        rows={kosong ? 2 : 1}
        placeholder="Tanya apa saja, / untuk perintah"
        className="max-h-40 w-full resize-none bg-transparent px-3 py-2 text-[15px] outline-none"
        style={{ color: "var(--shell)" }}
      />
      {/* Baris kontrol DI DALAM komposer -- gagasan dari Claude desktop:
          tambah, pemilih jalur, penanda mode, kirim. Semua dalam satu kotak. */}
      <div className="flex items-center gap-2 px-1 pt-1">
        <button
          className="flex h-7 w-7 items-center justify-center rounded-full text-[15px] transition hover:bg-white/10"
          style={{ color: "var(--redup)" }}
          title="Lampirkan materi ke korpus"
        >
          +
        </button>
        <PemilihJalur jalur={jalur} onGanti={setJalur} />
        <button
          onClick={() => setBanding((b) => !b)}
          aria-pressed={banding}
          title="Kirim ke kedua jalur sekaligus, jawabannya berdampingan"
          className="rounded-[var(--radius-kecil)] px-2 py-1 text-[11px] transition"
          style={
            banding
              ? { background: "var(--ocean)", color: "var(--shell)", boxShadow: "var(--pendar)" }
              : { color: "var(--redup)" }
          }
        >
          <span className="flex items-center gap-1.5">
            <IkonBanding ukuran={13} />
            Banding
          </span>
        </button>
        <span className="ml-auto flex items-center gap-3">
          {/* Hitungan cocok hanya berarti di jalur yang membaca korpus. */}
          <HitunganKorpus kueri={teks} aktif={jalur === "tiburon"} />
          <span
            className="angka text-[11px]"
            style={{ color: "var(--redup)" }}
            title="Ctrl+1 permukaan · Ctrl+2 korpus · Ctrl+3 dasar"
          >
            {jalur === "cepat" ? "0 m" : jalur === "tiburon" ? "200 m" : "1000 m"}
          </span>
        </span>
        <span className="relative inline-flex">
          <Sonar aktif={mencariKorpus} />
          <button
            onClick={() => void kirim()}
            disabled={sibuk || !teks.trim()}
            aria-label="Kirim pesan"
            className="relative rounded-[var(--radius)] px-3 py-1.5 text-[13px] transition disabled:opacity-30"
            style={{ background: "var(--surface)", color: "var(--abyss)" }}
          >
            {sibuk ? "…" : "Kirim"}
          </button>
        </span>
        </div>
      </div>
    </div>
  );

  const latar =
    jalur === "cepat"
      ? "var(--latar-cepat)"
      : jalur === "tiburon"
        ? "var(--latar-tiburon)"
        : "var(--latar-kode)";

  return (
    <div
      className="relative flex h-screen overflow-hidden"
      style={{ background: latar, transition: "background var(--alih-jalur)" }}
    >
      {/* Salju laut: hanya turun di kedalaman, makin rapat makin dalam. */}
      <SaljuLaut jalur={jalur} />

      {/* Pengukur kedalaman menempel di tepi kiri, setinggi layar. */}
      <div className="relative z-10 hidden shrink-0 pl-4 md:flex">
        <PengukurKedalaman jalur={jalur} />
      </div>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-6 py-8">
          {kuotaHabis && (
            <SpandukKuota pesan={kuotaHabis} onTutup={() => setKuotaHabis("")} />
          )}

          {galatRiwayat && (
            <div
              role="alert"
              className="mb-6 rounded-[var(--radius)] border px-4 py-3 text-[13px]"
              style={{ borderColor: "var(--warn)", color: "var(--warn)" }}
            >
              <IkonPeringatan ukuran={13} className="mr-1 inline-block align-[-2px]" />
              {galatRiwayat}
            </div>
          )}

          {kosong ? (
            <div className="pt-[12vh]">
              {/* Sapaan serif besar -- gagasan dari Claude desktop. Serif di
                  tengah antarmuka monospace terasa disengaja, bukan kebetulan. */}
              <h1
                className="mb-8 flex items-center justify-center gap-4 text-center text-[36px] leading-tight"
                style={{
                  color: "var(--shell)",
                  fontFamily: "var(--font-serif)",
                }}
              >
                <TandaTiburon ukuran={44} berdenyut />
                Tiburon siap
              </h1>

              {komposer}

              {/* Chip pintasan di bawah komposer -- gagasan dari Claude desktop. */}
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {[
                  "Apa isi radar pagi ini?",
                  "Cari di korpusku",
                  "Ringkas satu buku",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => setTeks(s)}
                    className="rounded-full border px-3 py-1 text-[12px] transition hover:brightness-125"
                    style={{ borderColor: "var(--garis)", color: "var(--redup)" }}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Bagian "Aktif" -- gagasan dari Claude desktop. */}
              <div className="mt-14">
                <div
                  className="mb-3 flex items-baseline justify-between text-[12px]"
                  style={{ color: "var(--redup)" }}
                >
                  <span>Korpus aktif</span>
                  {/* Dibaca sungguhan, bukan ditulis mati. Sebelumnya di sini
                      tertulis "164 berkas terindeks" sebagai angka tetap,
                      padahal korpusnya berisi jumlah yang sama sekali lain --
                      dan angka palsu di layar yang seluruh gunanya adalah
                      membuktikan isi korpus justru merusak maksudnya. */}
                  <span className="angka">
                    {ringkasKorpus === null
                      ? "membaca korpus…"
                      : `${ringkasKorpus.berkas} berkas · ${ringkasKorpus.potongan.toLocaleString("id-ID")} potongan`}
                  </span>
                </div>
                <div
                  className="flex items-center gap-3 rounded-[var(--radius)] border px-4 py-3"
                  style={{ borderColor: "var(--garis)" }}
                >
                  <IkonRadar ukuran={18} className="ikon-aktif shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[14px]" style={{ color: "var(--shell)" }}>
                      Radar Pagi — 3 September
                    </div>
                    <div className="text-[12px]" style={{ color: "var(--redup)" }}>
                      13 dari 40 item bertanda relevan untuk proyekmu
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-7">
              {kelompok.map((g, gi) =>
                g.jenis === "pengguna" ? (
                  <div key={gi} className="flex justify-end">
                    <div
                      className="max-w-[85%] rounded-[var(--radius-besar)] px-4 py-2.5 text-[14px]"
                      style={{ background: "var(--ocean)", color: "var(--shell)" }}
                    >
                      {g.isi}
                    </div>
                  </div>
                ) : g.jenis === "banding" ? (
                  /* Dua jawaban berdampingan. Bedanya bukan gaya bahasa --
                     yang satu membaca korpusmu, yang satu tidak. Perbedaan
                     ISI-nya yang jadi jawaban atas "apa gunanya korpus ini". */
                  <div key={gi} className="grid gap-4 md:grid-cols-2">
                    {g.balasan.map((p, i) => (
                      <div
                        key={i}
                        className="rounded-[var(--radius)] border p-3"
                        style={{
                          borderColor:
                            p.kolom === "tiburon" ? "var(--surface)" : "var(--garis)",
                          boxShadow: p.kolom === "tiburon" ? "var(--pendar)" : undefined,
                        }}
                      >
                        <div
                          className="mb-2 flex items-baseline justify-between text-[11px]"
                          style={{ color: "var(--redup)" }}
                        >
                          <span style={{ color: p.kolom === "tiburon" ? "var(--surface)" : undefined }}>
                            <span className="flex items-center gap-1.5">
                              {p.kolom === "tiburon" ? <IkonTiburon ukuran={12} /> : <IkonCepat ukuran={12} />}
                              {p.kolom === "tiburon" ? "dengan korpus" : "tanpa korpus"}
                            </span>
                          </span>
                          <span className="angka">{p.kolom === "tiburon" ? "200 m" : "0 m"}</span>
                        </div>
                        {isiBalasan(p, gi * 10 + i)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div key={gi} className="space-y-2">
                    {isiBalasan(g.balasan[0], gi)}
                  </div>
                ),
              )}
              <div ref={bawah} />
            </div>
            )}
          </div>
        </div>

        {/* Saat sudah ada pesan, komposer menempel di bawah. */}
        {!kosong && (
          <div className="shrink-0 px-6 pb-6">
            <div className="mx-auto w-full max-w-3xl">{komposer}</div>
          </div>
        )}
      </div>
    </div>
  );
}
