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

import { Suspense, useEffect, useRef, useState } from "react";
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
import { PesanPengguna } from "@/components/chat/PesanPengguna";
import { AreaLepas, DaftarLampiran, TombolLampir } from "@/components/chat/Lampiran";
import { TombolSuara } from "@/components/chat/TombolSuara";
import { BilahAtas } from "@/components/chat/BilahAtas";
import { PanelPintasan } from "@/components/chat/PanelPintasan";
import { PanelArtefak, ChipArtefak } from "@/components/chat/PanelArtefak";
import { KartuStatistik } from "@/components/chat/KartuStatistik";
import { JejakAlat, type Jejak } from "@/components/chat/JejakAlat";
import { TandaTiburon } from "@/components/TandaTiburon";
import { judulDari } from "@/lib/judul";
import { susunDenganLampiran, type Lampiran as Berkas } from "@/lib/lampiran";
import { keMarkdown, keJson, namaBerkas, unduh } from "@/lib/ekspor";
import { artefakPercakapan, kenaliArtefak } from "@/lib/artefak";
import {
  IkonBanding,
  IkonCepat,
  IkonModel,
  IkonHenti,
  IkonPeringatan,
  IkonRadar,
  IkonTiburon,
  IkonTurun,
} from "@/components/Ikon";
import { useRouter, useSearchParams } from "next/navigation";

type KejadianAliran =
  | { jenis: "model"; nama: string }
  | { jenis: "teks"; teks: string }
  | { jenis: "sumber"; berkas: string[] }
  | { jenis: "peringatan"; pesan: string }
  | { jenis: "gagal"; pesan: string }
  // Dua kejadian ini HANYA datang dari /api/agen. Disatukan ke dalam tipe yang
  // sama karena pembacanya sama; yang membedakan cuma rutenya.
  | { jenis: "alat-mulai"; nama: string; ringkas: string }
  | { jenis: "alat-selesai"; nama: string; hasil: string }
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
  /** Dihentikan pengguna di tengah jalan. Dibedakan dari gagal: jawabannya
   *  tetap sah sejauh yang sempat ditulis, cuma belum selesai. */
  dihentikan?: boolean;
  /** Alat yang dipanggil agen untuk sampai ke jawaban ini. Kosong di jalur
   *  lain. Ini yang membuat jawaban agen bisa diperiksa, bukan dipercaya. */
  jejak?: Jejak[];
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

/**
 * Batas Suspense mengelilingi layar obrolan.
 *
 * WAJIB, bukan pilihan gaya: `useSearchParams` memaksa komponen keluar dari
 * prerender statis, dan Next menolak membangun halaman ini tanpa batas
 * Suspense di atasnya ("useSearchParams() should be wrapped in a suspense
 * boundary"). Batasnya ditaruh di sini, di berkas halaman, supaya kerangka
 * aplikasi di layout tetap tampil seketika sementara isinya menyusul.
 */
export default function HalamanObrolan() {
  return (
    <Suspense fallback={<KerangkaObrolan />}>
      <IsiObrolan />
    </Suspense>
  );
}

/**
 * Yang tampil selama sepersekian detik sebelum obrolan siap.
 *
 * Sengaja bukan pemintal berputar. Yang muncul adalah BENTUK layar yang
 * sebentar lagi ada -- kolom terpusat dengan komposer di bawah -- sehingga
 * tidak ada yang berpindah tempat saat isinya datang.
 */
function KerangkaObrolan() {
  return (
    <div className="flex h-screen items-end justify-center">
      <div className="mx-auto mb-6 w-full max-w-3xl px-6">
        <div
          className="h-[52px] w-full rounded-[var(--radius-besar)] border"
          style={{ borderColor: "var(--garis)", background: "var(--lapis-1)" }}
        />
      </div>
    </div>
  );
}

function IsiObrolan() {
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
  const [lampiran, setLampiran] = useState<Berkas[]>([]);
  const [galatLampiran, setGalatLampiran] = useState("");
  const [ikutiBawah, setIkutiBawah] = useState(true);
  const [judul, setJudul] = useState("Obrolan baru");
  const [pintasanTerbuka, setPintasanTerbuka] = useState(false);
  const [artefakAktif, setArtefakAktif] = useState<string | null>(null);
  const bawah = useRef<HTMLDivElement>(null);
  const gulir = useRef<HTMLDivElement>(null);
  const pembatal = useRef<AbortController | null>(null);
  const router = useRouter();
  const paramCari = useSearchParams();

  const untukEkspor = () =>
    pesan.map((p) => ({
      peran: p.peran,
      isi: p.isi,
      model: p.model,
      sumber: p.sumber,
    }));

  /**
   * Cabangkan percakapan.
   *
   * Membuat percakapan BARU berisi salinan seluruh pesan sampai saat ini, lalu
   * berpindah ke sana. Yang asli tidak disentuh sama sekali — itu seluruh
   * gunanya: mencoba arah lain tanpa merusak jalur yang sudah bagus.
   *
   * Berbeda dari menyunting pesan, yang justru MEMBUANG apa yang ada di
   * bawahnya. Keduanya menjawab kebutuhan yang berbeda: menyunting untuk
   * memperbaiki pertanyaan yang salah, mencabangkan untuk menjajaki dua
   * kemungkinan sekaligus.
   */
  async function cabangkan() {
    if (sibuk || pesan.length === 0) return;
    try {
      const r = await fetch("/api/percakapan", {
        method: "POST",
        body: JSON.stringify({ judul: `${judul} (cabang)` }),
      });
      if (!r.ok) throw new Error((await r.json()).pesan ?? `HTTP ${r.status}`);
      const { id } = await r.json();

      // Disalin BERURUTAN, bukan lewat Promise.all: urutan pesan di sini
      // ditentukan oleh urutan penyisipan (kolom id AUTOINCREMENT), jadi
      // mengirimnya bersamaan bisa mengacak percakapan hasil salinannya.
      for (const p of pesan) {
        await fetch("/api/percakapan", {
          method: "PUT",
          // Model ikut disalin: cabang yang kehilangan atribusi jawabannya jadi
          // riwayat yang tidak bisa ditelusuri balik ke model mana pun.
          body: JSON.stringify({
            id,
            pesan: { role: p.peran, content: p.isi, model: p.model },
          }),
        });
      }
      router.push(`/app?id=${id}`);
    } catch (e) {
      setGalatRiwayat(`Gagal mencabangkan: ${(e as Error).message}`);
    }
  }

  /**
   * Hentikan jawaban yang sedang mengalir.
   *
   * Yang sudah sempat ditulis DIPERTAHANKAN, tidak dihapus. Jawaban setengah
   * jadi kerap sudah menjawab pertanyaannya -- itu justru alasan orang menekan
   * tombol ini -- dan membuangnya menghukum tindakan yang benar.
   */
  function hentikan() {
    pembatal.current?.abort();
  }

  /**
   * Tambah lampiran, tolak yang namanya sudah ada.
   *
   * Nama dipakai sebagai identitas karena itulah yang dilihat pengguna di
   * chip-nya. Melampirkan dua berkas bernama sama menghasilkan dua chip yang
   * tidak bisa dibedakan, dan tombol buang pada salah satunya akan membuang
   * keduanya.
   */
  function tambahLampiran(baru: Berkas[]) {
    setGalatLampiran("");
    setLampiran((lama) => {
      const ada = new Set(lama.map((l) => l.nama));
      return [...lama, ...baru.filter((b) => !ada.has(b.nama))];
    });
  }

  // Menu perintah muncul saat kotak diawali "/" dan belum ada spasi.
  const menuTerbuka = teks.startsWith("/") && !teks.includes(" ");

  /**
   * Gulir otomatis, TAPI hanya selama pengguna memang berada di bawah.
   *
   * Sebelum ini setiap potongan teks yang masuk memanggil scrollIntoView tanpa
   * syarat — jadi menggulir ke atas untuk membaca ulang sesuatu di tengah
   * jawaban yang panjang akan langsung menyeret kembali ke bawah, berkali-kali
   * per detik. Itu membuat jawaban panjang praktis tidak bisa dibaca sampai
   * selesai.
   *
   * Sekarang: menggulir ke atas mematikan pengikutan, dan kembali ke dasar
   * menyalakannya lagi. Persis seperti Claude dan ChatGPT.
   */
  useEffect(() => {
    if (ikutiBawah) bawah.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [pesan, ikutiBawah]);

  useEffect(() => {
    const el = gulir.current;
    if (!el) return;
    function periksa() {
      const el = gulir.current;
      if (!el) return;
      // 80px, bukan 0: gulir mulus jarang berhenti tepat di piksel terakhir,
      // dan ambang nol akan mematikan pengikutan karena selisih beberapa
      // piksel yang tidak pernah dimaksudkan siapa pun.
      const diBawah = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      setIkutiBawah(diBawah);
    }
    el.addEventListener("scroll", periksa, { passive: true });
    return () => el.removeEventListener("scroll", periksa);
  }, []);

  /**
   * "?" membuka daftar pintasan -- TAPI hanya kalau fokus tidak sedang di
   * kotak teks. Tanpa penjaga itu, mengetik tanda tanya di tengah pertanyaan
   * akan membuka dialog dan menelan karakternya.
   */
  useEffect(() => {
    function tekan(e: KeyboardEvent) {
      if (e.key !== "?" || e.ctrlKey || e.metaKey) return;
      const el = document.activeElement;
      const mengetik =
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLInputElement ||
        (el as HTMLElement | null)?.isContentEditable;
      if (mengetik) return;
      e.preventDefault();
      setPintasanTerbuka(true);
    }
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, []);

  // Esc menghentikan jawaban yang mengalir. Tidak dianimasikan dan tidak
  // meminta konfirmasi -- pintasan papan ketik untuk menghentikan sesuatu
  // harus seketika, atau ia kalah cepat dari menekan tombolnya.
  useEffect(() => {
    function tekan(e: KeyboardEvent) {
      if (e.key === "Escape" && sibuk) hentikan();
    }
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [sibuk]);

  // Pintasan kedalaman: Ctrl/Cmd + 1, 2, 3.
  //
  // Sengaja TANPA animasi pemicu apa pun -- aksi yang dijalankan lewat papan
  // ketik dipakai puluhan kali sehari, dan animasi di sana jadi hambatan.
  // Pengukur kedalaman di tepi tetap berpindah 180ms; itu sudah cukup jadi
  // umpan balik.
  useEffect(() => {
    function tekan(e: KeyboardEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      const peta: Record<string, Jalur> = {
        "1": "cepat",
        "2": "tiburon",
        "3": "agen",
        "4": "kode",
      };
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
        // `?id=` dari sidebar menang. Tanpa ini, mengklik percakapan mana pun
        // di sidebar akan selalu membuka percakapan TERBARU, bukan yang diklik.
        let id = paramCari.get("id");
        // Daftar tetap diambil walau id-nya sudah diketahui: judulnya ada di
        // sana, dan bilah atas butuh judul yang sebenarnya, bukan "Obrolan
        // baru" yang menempel selamanya.
        const r = await fetch("/api/percakapan");
        if (!r.ok) throw new Error(`daftar percakapan: HTTP ${r.status}`);
        const daftar: { id: string; judul: string }[] = await r.json();
        if (dibatalkan) return;
        if (!id) {
          if (!daftar.length) return;
          id = daftar[0].id;
        }
        const ketemu = daftar.find((d) => d.id === id);
        if (ketemu) setJudul(ketemu.judul);
        const rp = await fetch(`/api/percakapan?id=${id}`);
        if (!rp.ok) throw new Error(`isi percakapan: HTTP ${rp.status}`);
        const lama: { role: string; content: string; model?: string | null }[] =
          await rp.json();
        if (dibatalkan) return;
        setIdPercakapan(id);
        setPesan(
          lama.map((p) => ({
            peran: p.role as "user" | "assistant",
            isi: p.content,
            // Lencana "dijawab oleh" ikut kembali setelah muat ulang. Sebelum
            // kolomnya ada, nilai ini null di baris lama -- dan lencana yang
            // tidak muncul lebih jujur daripada lencana yang menebak.
            model: p.model ?? undefined,
          })),
        );
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
    // Dijalankan ulang tiap kali `?id=` berubah: berpindah percakapan lewat
    // sidebar tidak memuat ulang halaman, jadi tanpa ketergantungan ini isi
    // percakapan lama akan tetap terpampang di bawah judul yang baru.
  }, [paramCari]);

  async function pastikanPercakapan(judul: string): Promise<string | null> {
    if (idPercakapan) return idPercakapan;
    try {
      const r = await fetch("/api/percakapan", {
        method: "POST",
        body: JSON.stringify({ judul: judulDari(judul) }),
      });
      if (!r.ok) return null;
      const { id } = await r.json();
      setIdPercakapan(id);
      setJudul(judulDari(judul));
      return id;
    } catch {
      return null;
    }
  }

  function simpan(
    id: string | null,
    role: "user" | "assistant",
    content: string,
    model: string | null = null,
  ) {
    if (!id) return;
    void fetch("/api/percakapan", {
      method: "PUT",
      body: JSON.stringify({ id, pesan: { role, content, model } }),
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

    // Mode agen punya rutenya sendiri: bentuk percakapannya berbeda sampai ke
    // akar (pesan `tool`, panggilan berulang, tanpa aliran token), jadi
    // menyatukannya dengan /api/cepat berarti satu rute dengan dua alur yang
    // tidak berbagi apa pun selain namanya.
    const rute = jalurDipakai === "agen" ? "/api/agen" : "/api/cepat";

    try {
      const resp = await fetch(rute, {
        method: "POST",
        // Sinyal yang sama dipakai kedua aliran saat mode banding, jadi satu
        // tekan "Hentikan" menghentikan keduanya. Menghentikan satu kolom saja
        // meninggalkan perbandingan yang tidak bisa dibandingkan.
        signal: pembatal.current?.signal,
        body: JSON.stringify({
          jalur: jalurDipakai,
          // Id percakapan dikirim supaya server bisa mencari instruksi
          // proyeknya. Instruksinya sendiri TIDAK dikirim dari sini: kalau
          // klien yang mengirim isi prompt sistem, siapa pun yang bisa
          // memanggil rute ini bisa menyuntik apa pun ke dalamnya.
          percakapan: idPercakapan,
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

          // Sonar berdenyut selama agen memanggil alat, sama seperti saat
          // jalur Tiburon mencari korpus: satu bahasa visual, satu arti.
          if (k.jenis === "alat-mulai") setMencariKorpus(true);
          if (k.jenis === "alat-selesai") matikanSonar();
          tulis((akhir) => {
            if (k.jenis === "teks") akhir.isi += k.teks;
            if (k.jenis === "model") akhir.model = k.nama;

            if (k.jenis === "alat-mulai") {
              akhir.jejak = [...(akhir.jejak ?? []), { nama: k.nama, ringkas: k.ringkas }];
            }
            if (k.jenis === "alat-selesai") {
              // Hasil dipasang ke jejak TERAKHIR yang namanya cocok dan belum
              // punya hasil. Mencocokkan lewat nama saja akan salah kalau alat
              // yang sama dipanggil dua kali dalam satu giliran -- dan itu
              // justru yang sering dilakukan agen saat menyempurnakan kuerinya.
              const daftar = [...(akhir.jejak ?? [])];
              for (let i = daftar.length - 1; i >= 0; i--) {
                if (daftar[i].nama === k.nama && daftar[i].hasil === undefined) {
                  daftar[i] = { ...daftar[i], hasil: k.hasil };
                  break;
                }
              }
              akhir.jejak = daftar;
            }
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
      // Dihentikan sendiri BUKAN kegagalan. fetch melempar AbortError saat
      // sinyalnya dibatalkan, dan menampilkannya sebagai galat merah akan
      // membuat aplikasi seolah rusak tepat setelah pengguna menekan tombol
      // yang memang bermaksud menghentikannya.
      if ((e as Error).name === "AbortError") {
        tulis((akhir) => {
          akhir.dihentikan = true;
        });
        return;
      }
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

    // Isi lampiran disatukan ke dalam pesan SEBELUM dikirim, dan pesan gabungan
    // itulah yang disimpan ke riwayat. Kalau yang disimpan cuma pertanyaannya,
    // memuat ulang percakapan akan menghasilkan jawaban yang merujuk berkas
    // yang sudah tidak ada di mana pun.
    const dikirim = susunDenganLampiran(teks, lampiran);
    const pertanyaan = teks;
    setTeks("");
    setLampiran([]);
    setGalatLampiran("");
    // `pertanyaan` dipisah dari `dikirim` khusus untuk judul: kalau ada
    // lampiran, `dikirim` DIAWALI isi berkas, dan judul otomatis akan
    // mengambil baris pertama berkas itu alih-alih pertanyaannya.
    await jalankan(dikirim, [...pesan, { peran: "user", isi: dikirim }], pertanyaan);
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
   * Sunting satu pertanyaan lalu jalankan ulang dari titik itu.
   *
   * Semua yang ada SETELAH pesan itu dibuang, termasuk pertanyaan-pertanyaan
   * berikutnya. Terasa keras, tapi alternatifnya lebih buruk: jawaban dan
   * pertanyaan lanjutan yang muncul karena versi lama tidak lagi masuk akal
   * begitu premisnya berubah, dan menyimpannya menghasilkan riwayat yang tidak
   * mungkin pernah terjadi.
   */
  async function sunting(indeks: number, baru: string) {
    if (sibuk) return;
    const sebelumnya = pesan.slice(0, indeks);
    await jalankan(baru, [...sebelumnya, { peran: "user", isi: baru }]);
  }

  /**
   * Inti pengiriman, dipakai bersama oleh `kirim` dan `ulangi`.
   *
   * `riwayat` sudah harus berakhir pada pesan pengguna yang mau dijawab —
   * itulah satu-satunya perbedaan antara mengirim baru dan mengulang.
   */
  async function jalankan(dikirim: string, riwayat: Balasan[], untukJudul = dikirim) {
    // Mode banding menaruh DUA balasan kosong sekaligus, satu per kolom.
    const barisBaru: Balasan[] = banding
      ? [
          { peran: "assistant", isi: "", kueri: dikirim, kolom: "cepat" },
          { peran: "assistant", isi: "", kueri: dikirim, kolom: "tiburon" },
        ]
      : [{ peran: "assistant", isi: "", kueri: dikirim }];

    setPesan([...riwayat, ...barisBaru]);
    setSibuk(true);
    // Controller BARU tiap kiriman: sebuah AbortController yang sudah dibatalkan
    // tidak bisa dipakai lagi -- memakai ulang yang lama membuat kiriman
    // berikutnya batal seketika sebelum sempat mengirim apa pun.
    pembatal.current = new AbortController();

    // Sonar hanya berdenyut kalau ada jalur yang benar-benar mencari korpus.
    bolehMatikanSonar = true;
    if (banding || jalur === "tiburon") {
      setMencariKorpus(true);
      bolehMatikanSonar = false;
      window.setTimeout(() => {
        bolehMatikanSonar = true;
      }, 700);
    }

    const id = await pastikanPercakapan(untukJudul);
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
        const balasan = lama.slice(awal);
        const isi = balasan
          .map((b) => (b.kolom ? `[${b.kolom}] ${b.isi}` : b.isi))
          .filter(Boolean)
          .join("\n\n");

        // Satu baris tersimpan punya SATU kolom model. Mode banding menyatukan
        // dua jawaban jadi satu baris, dan kalau kedua kolomnya dijawab model
        // yang berbeda, tidak ada satu nama yang benar untuk baris itu -- maka
        // dicatat null, bukan diambil salah satunya. Angka statistik yang kurang
        // satu lebih baik daripada angka yang mengaku tahu padahal tidak.
        const dipakai = [...new Set(balasan.map((b) => b.model).filter(Boolean))];

        if (isi) simpan(id, "assistant", isi, dipakai.length === 1 ? dipakai[0]! : null);
        return lama;
      });
    } finally {
      setSibuk(false);
      matikanSonar();
    }
  }

  const kosong = pesan.length === 0;
  const semuaArtefak = artefakPercakapan(pesan);

  /**
   * Pesan datar dikelompokkan untuk render.
   *
   * Dua balasan asisten berurutan yang punya `kolom` berasal dari satu
   * pertanyaan yang dibandingkan, jadi keduanya dirender berdampingan.
   */
  type Kelompok =
    // `indeks` dibawa serta supaya menyunting tahu persis di mana pesan itu
    // berada di `pesan[]`; posisi di dalam `kelompok` tidak sama, karena mode
    // banding memampatkan dua balasan jadi satu kelompok.
    | { jenis: "pengguna"; isi: string; indeks: number }
    | { jenis: "tunggal"; balasan: Balasan[] }
    | { jenis: "banding"; balasan: Balasan[] };

  const kelompok: Kelompok[] = [];
  for (let i = 0; i < pesan.length; i++) {
    const p = pesan[i];
    if (p.peran === "user") {
      kelompok.push({ jenis: "pengguna", isi: p.isi, indeks: i });
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
        {p.jejak && <JejakAlat jejak={p.jejak} />}
        <div className="text-[15px] leading-[1.75]" style={{ color: "var(--teks-utama)" }}>
          <Markdown isi={p.isi} />
          {sibuk && !p.isi && (
            <span
              className="kursor ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px]"
              style={{ background: "var(--surface)" }}
            />
          )}
        </div>
        {p.dihentikan && (
          <div className="mt-1 text-[11px]" style={{ color: "var(--teks-redup)" }}>
            Dihentikan. Yang di atas adalah sejauh yang sempat ditulis.
          </div>
        )}
        {/* Artefak hanya dikenali saat jawaban SELESAI. Blok yang belum
            tertutup pagarnya masih berubah di tiap potongan teks yang masuk,
            dan chip yang isinya berganti-ganti tidak bisa diklik dengan
            tenang. */}
        {!sibuk && (
          <ChipArtefak
            artefak={kenaliArtefak(p.isi)}
            onBuka={(id) => setArtefakAktif(id)}
          />
        )}
        {/* Aksi hanya muncul pada jawaban yang sudah selesai: menyalin atau
            mengulang jawaban yang masih setengah jalan tidak pernah berguna. */}
        {p.isi && !sibuk && <AksiPesan isi={p.isi} onUlangi={() => ulangi()} />}
      </div>
    );
  }


  const komposer = (
    <AreaLepas onTambah={tambahLampiran} onGalat={setGalatLampiran}>
    <div className="w-full">
      {menuTerbuka && <MenuPerintah kueri={teks} onPilih={jalankanPerintah} />}

      {galatLampiran && (
        <div
          role="alert"
          className="naik mb-2 rounded-[var(--radius-kecil)] border px-2.5 py-1.5 text-[11px]"
          style={{ borderColor: "var(--warn)", color: "var(--warn)" }}
        >
          {galatLampiran}
        </div>
      )}

      <DaftarLampiran
        lampiran={lampiran}
        onBuang={(nama) => setLampiran((d) => d.filter((l) => l.nama !== nama))}
      />

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
        <TombolLampir onTambah={tambahLampiran} onGalat={setGalatLampiran} nonaktif={sibuk} />
        {/* Hasil dikte DISAMBUNG ke teks yang sudah ada, tidak menggantinya:
            mengetik separuh lalu mendiktekan sisanya adalah cara orang
            benar-benar memakai ini. */}
        <TombolSuara
          nonaktif={sibuk}
          onTeks={(t) => setTeks((lama) => (lama ? `${lama.replace(/\s+$/, "")} ${t}` : t))}
        />
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
            { { cepat: "0 m", tiburon: "200 m", agen: "600 m", kode: "1000 m" }[jalur] }
          </span>
        </span>
        <span className="relative inline-flex">
          <Sonar aktif={mencariKorpus} />
          {/* Satu tombol yang BERGANTI PERAN, bukan dua tombol berdampingan.
              Saat jawaban mengalir, satu-satunya hal yang masuk akal dilakukan
              di tempat itu adalah menghentikannya -- dan tombol Kirim yang
              kelabu di sebelah tombol Hentikan cuma menambah sasaran yang
              harus dihindari. */}
          {sibuk ? (
            <button
              onClick={hentikan}
              aria-label="Hentikan jawaban"
              title="Hentikan (Esc)"
              className="relative flex items-center gap-1.5 rounded-[var(--radius)] px-3 py-1.5 text-[13px] transition"
              style={{ background: "var(--lapis-2)", color: "var(--teks-kedua)" }}
            >
              <IkonHenti ukuran={12} />
              Hentikan
            </button>
          ) : (
            <button
              onClick={() => void kirim()}
              disabled={!teks.trim()}
              aria-label="Kirim pesan"
              className="relative rounded-[var(--radius)] px-3 py-1.5 text-[13px] transition disabled:opacity-30"
              style={{ background: "var(--surface)", color: "var(--abyss)" }}
            >
              Kirim
            </button>
          )}
        </span>
        </div>
      </div>
    </div>
    </AreaLepas>
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

      <div className="relative z-10 flex min-w-0 flex-1">
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Bilah atas hanya muncul kalau sudah ada pesan: ekspor dan cabang
            di atas layar kosong menawarkan tindakan yang mustahil. */}
        {!kosong && (
          <BilahAtas
            judul={judul}
            jumlahPesan={pesan.length}
            pesan={pesan}
            onCabang={() => void cabangkan()}
            onPintasan={() => setPintasanTerbuka(true)}
            onEksporMd={() =>
              unduh(namaBerkas(judul, "md"), keMarkdown(judul, untukEkspor()), "text/markdown")
            }
            onEksporJson={() =>
              unduh(namaBerkas(judul, "json"), keJson(judul, untukEkspor()), "application/json")
            }
          />
        )}

        {pintasanTerbuka && <PanelPintasan onTutup={() => setPintasanTerbuka(false)} />}

        <div ref={gulir} className="relative flex-1 overflow-y-auto">
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

              {/* Statistik pemakaian -- gagasan dari layar pembuka Claude
                  desktop. Menggantikan ruang kosong dengan sesuatu yang tidak
                  bisa ditebak siapa pun kecuali aplikasi ini sendiri. */}
              <div className="mt-12">
                <KartuStatistik />
              </div>

              {/* Bagian "Aktif" -- gagasan dari Claude desktop. */}
              <div className="mt-8">
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
                  <PesanPengguna
                    key={gi}
                    isi={g.isi}
                    sibuk={sibuk}
                    onSunting={(baru) => void sunting(g.indeks, baru)}
                  />
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
          <div className="relative shrink-0 px-6 pb-6">
            {/* Tombol turun, tepat di atas komposer. Muncul HANYA saat
                pengikutan mati -- kalau ia selalu ada, ia jadi tombol yang
                tidak pernah melakukan apa pun di 95% waktu, dan mata belajar
                mengabaikannya persis pada saat ia dibutuhkan. */}
            {!ikutiBawah && (
              <button
                onClick={() => {
                  setIkutiBawah(true);
                  bawah.current?.scrollIntoView?.({ behavior: "smooth" });
                }}
                aria-label="Turun ke pesan terbaru"
                className="naik absolute -top-5 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border"
                style={{
                  borderColor: "var(--garis)",
                  background: "var(--lapis-2)",
                  color: "var(--teks-kedua)",
                  boxShadow: "var(--panel)",
                }}
              >
                <IkonTurun ukuran={16} />
              </button>
            )}
            <div className="mx-auto w-full max-w-3xl">{komposer}</div>
          </div>
        )}
      </div>

      {/* Panel artefak, di SAMPING percakapan. Seluruh gunanya adalah bisa
          membaca kode sambil melihat kalimat yang menjelaskannya; panel yang
          menimpa percakapan cuma memindahkan masalah menggulir. */}
      {artefakAktif && semuaArtefak.length > 0 && (
        <PanelArtefak
          artefak={semuaArtefak}
          aktif={artefakAktif}
          onPilih={setArtefakAktif}
          onTutup={() => setArtefakAktif(null)}
        />
      )}
      </div>
    </div>
  );
}
