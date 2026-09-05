/**
 * Alat yang bisa dipanggil Tiburon sendiri.
 *
 * Ini yang membedakan mode Agent dari mode obrolan biasa: alih-alih menjawab
 * dari satu potret konteks yang sudah disiapkan sebelum ia mulai bicara,
 * Tiburon boleh MENCARI dulu, membaca hasilnya, lalu memutuskan apakah perlu
 * mencari lagi. Itu pola yang dipakai Hermes di Antigravity dan agen OpenClaw.
 *
 * Empat aturan yang membentuk daftar ini:
 *
 * 1. SEMUANYA HANYA BACA. Tidak ada alat yang menulis berkas, menjalankan
 *    perintah, atau menghubungi jaringan. Agen yang bisa menulis butuh lapisan
 *    izin per tindakan, dan lapisan itu belum ada; menambahkan alat tulis
 *    sebelum izinnya siap berarti satu jawaban yang salah bisa menghapus
 *    sesuatu.
 *
 * 2. Semuanya menjawab dari data yang SUDAH DIMILIKI Veldan — korpus, radar,
 *    jadwal, riwayat sumber. Alat yang menghubungi internet akan membuat
 *    jawaban tidak bisa diperiksa ulang, dan itu melawan seluruh alasan
 *    proyek ini ada.
 *
 * 3. Tiap alat mengembalikan TEKS, bukan objek. Model membaca teks; JSON yang
 *    diserahkan mentah-mentah membuatnya menghabiskan token untuk mengurai
 *    tanda kurung alih-alih memahami isinya.
 *
 * 4. Gagal adalah HASIL, bukan pengecualian. Alat yang melempar akan
 *    menghentikan seluruh giliran; alat yang mengembalikan "tidak bisa
 *    dibaca karena X" membiarkan model memberi tahu kenapa ia tidak bisa
 *    menjawab.
 */
import { cari, periksaSkema, daftarBerkas } from "@/lib/korpus";
import { petaLabel } from "@/lib/label-berkas";
import type { Tindakan as TindakanIzin } from "@/lib/izin";
import { bacaBerkas } from "@/lib/baca-berkas";
import { bacaRadar } from "@/lib/radar-parser";
import { ringkasSumber } from "@/lib/sumber-terpakai";

/** Skema alat dalam format OpenAI/OpenRouter function calling. */
export type SkemaAlat = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: string; description: string }>;
      required: string[];
    };
  };
};

/**
 * Dipanggil alat yang membaca korpus, dengan berkas yang dibacanya DAN
 * kueri yang dipakainya.
 *
 * Kuerinya ikut karena kartu sumber mencari ulang potongannya untuk
 * ditampilkan. Agen memakai kueri hasil rumusannya sendiri, bukan
 * pertanyaan mentah penggunanya, jadi mencari ulang dengan pertanyaan asli
 * bisa membuka kartu yang kosong — kegagalan senyap tepat di fitur yang
 * ada untuk membuktikan jawabannya.
 */
type Lapor = (berkas: string[], kueri: string) => void;

/**
 * Konteks satu pemanggilan alat.
 *
 * Satu objek, bukan deretan argumen: menambah kemampuan baru nanti
 * (pembatalan, anggaran, pencatatan) tidak akan memaksa tiap alat
 * mengubah tanda tangannya.
 */
export type KonteksAlat = {
  lapor?: Lapor;
  /** Ajukan izin dan tunggu jawabannya. Tidak ada = anggap tidak diizinkan. */
  mintaIzin?: (t: TindakanIzin) => Promise<boolean>;
};

type Alat = {
  skema: SkemaAlat;
  /**
   * `lapor` dipanggil dengan label berkas korpus yang benar-benar dibaca.
   *
   * Ada supaya jalur Agen bisa menyebut sumbernya seperti jalur Tiburon.
   * Tanpa ini, jalur yang paling banyak membaca korpus justru satu-satunya
   * yang jawabannya tidak bisa diperiksa: tidak ada chip sumber, tidak ada
   * yang bisa dibuka, dan tidak ada yang tercatat di Riwayat sumber.
   */
  /**
   * Boleh mengembalikan janji.
   *
   * Alat yang butuh bertanya ke Veldan harus menunggu jawabannya, dan
   * menunggu berarti async. Alat lama yang mengembalikan string langsung
   * tetap sah — `string` adalah `string | Promise<string>` yang valid.
   */
  jalankan: (arg: Record<string, unknown>, ctx?: KonteksAlat) => string | Promise<string>;
  /** Ringkasan satu baris untuk ditampilkan di antarmuka. */
  ringkas: (arg: Record<string, unknown>) => string;
};

function teksArg(arg: Record<string, unknown>, kunci: string): string {
  const v = arg[kunci];
  return typeof v === "string" ? v : "";
}

const DAFTAR: Alat[] = [
  {
    skema: {
      type: "function",
      function: {
        name: "cari_korpus",
        description:
          "Cari di korpus pribadi Veldan (catatan, analisis buku, transkrip video). " +
          "Pakai ini SEBELUM menjawab pertanyaan apa pun yang mungkin sudah dia tulis sendiri. " +
          "Mengembalikan potongan teks beserta nama berkas asalnya.",
        parameters: {
          type: "object",
          properties: {
            kueri: { type: "string", description: "Kata kunci pencarian." },
          },
          required: ["kueri"],
        },
      },
    },
    ringkas: (a) => `Mencari korpus: “${teksArg(a, "kueri")}”`,
    jalankan: (a, ctx) => {
      const kueri = teksArg(a, "kueri").trim();
      if (!kueri) return "Kueri kosong.";

      const skema = periksaSkema();
      if (!skema.cocok) return `Korpus tidak terbaca: ${skema.alasan}`;

      try {
        const hasil = cari(kueri, 6);
        // Label unik, bukan nama berkas. Korpus ini berisi tiga berkas
        // bernama 2026-09-03.md di folder berbeda; menyebut namanya saja
        // membuat model mengutip sumber yang tidak bisa ditelusuri, dan ia
        // sendiri tidak punya cara membedakan ketiganya.
        const label = petaLabel(daftarBerkas().map((x) => x.path));
        if (hasil.length === 0) return `Tidak ada yang cocok dengan "${kueri}" di korpus.`;
        ctx?.lapor?.([...new Set(hasil.map((h) => label.get(h.path) ?? h.path))], kueri);
        return hasil
          .map((h) => {
            const nama = label.get(h.path) ?? h.path;
            // Dipotong 700 karakter per potongan: enam potongan penuh bisa
            // memakan seluruh sisa jendela konteks, dan giliran berikutnya
            // gagal sebelum model sempat menjawab apa pun.
            return `[${nama}]\n${h.teks.slice(0, 700)}`;
          })
          .join("\n\n---\n\n");
      } catch (e) {
        return `Pencarian korpus gagal: ${(e as Error).message}`;
      }
    },
  },

  {
    skema: {
      type: "function",
      function: {
        name: "daftar_berkas_korpus",
        description:
          "Daftar semua berkas di korpus Veldan beserta jumlah potongannya. " +
          "Pakai untuk menjawab 'apa saja yang kupunya' atau saat cari_korpus tidak menemukan apa pun.",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    ringkas: () => "Melihat daftar berkas korpus",
    jalankan: () => {
      const skema = periksaSkema();
      if (!skema.cocok) return `Korpus tidak terbaca: ${skema.alasan}`;
      try {
        const b = daftarBerkas();
        // Tanpa label, tiga berkas senama tampil sebagai tiga baris identik --
        // daftar yang terbaca seperti alat yang rusak.
        const label = petaLabel(b.map((x) => x.path));
        if (b.length === 0) return "Korpus kosong.";
        return b
          .map((x) => `${label.get(x.path) ?? x.path} (${x.potongan} potongan)`)
          .join("\n");
      } catch (e) {
        return `Daftar korpus gagal dibaca: ${(e as Error).message}`;
      }
    },
  },

  {
    skema: {
      type: "function",
      function: {
        name: "baca_radar",
        description:
          "Baca laporan Radar Pagi untuk satu tanggal: berita teknologi dunia dan repo GitHub yang sedang naik. " +
          "Tanggal dalam format YYYY-MM-DD. Kosongkan untuk hari ini.",
        parameters: {
          type: "object",
          properties: {
            tanggal: { type: "string", description: "YYYY-MM-DD, atau kosong untuk hari ini." },
          },
          required: [],
        },
      },
    },
    ringkas: (a) => `Membaca radar ${teksArg(a, "tanggal") || "hari ini"}`,
    jalankan: (a) => {
      const t = teksArg(a, "tanggal").trim();
      // Tanggal divalidasi sebelum dipakai: string sembarang dari model akan
      // jadi `Invalid Date`, dan bacaRadar akan mencari berkas bernama
      // "Invalid Date" alih-alih memberi tahu bahwa tanggalnya salah.
      const tanggal = t ? new Date(`${t}T00:00:00`) : new Date();
      if (Number.isNaN(tanggal.getTime())) {
        return `Tanggal "${t}" tidak valid. Pakai format YYYY-MM-DD.`;
      }

      try {
        const laporan = bacaRadar(tanggal);
        if (!laporan) return `Belum ada laporan radar untuk ${t || "hari ini"}.`;
        const berita = laporan.berita
          .slice(0, 15)
          .map((b) => `${b.nomor}. [${b.kategori}] ${b.judul} — ${b.ringkasan} (${b.sumber})`)
          .join("\n");
        const github = laporan.github
          .slice(0, 10)
          .map((g) => `${g.nomor}. ${g.judul} — ${g.ringkasan}`)
          .join("\n");
        return `Radar ${laporan.tanggal}\n\nBERITA:\n${berita}\n\nGITHUB:\n${github || "(kosong)"}`;
      } catch (e) {
        return `Radar gagal dibaca: ${(e as Error).message}`;
      }
    },
  },

  {
    skema: {
      type: "function",
      function: {
        name: "baca_berkas",
        description:
          "Baca isi satu berkas teks dari mesin ini. Hanya di dalam folder " +
          "yang diizinkan; berkas rahasia dan berkas biner selalu ditolak. " +
          "Berkas panjang dipotong, dan pemotongannya disebut di atas isinya.",
        parameters: {
          type: "object",
          properties: {
            jalur: { type: "string", description: "Jalur berkasnya." },
          },
          required: ["jalur"],
        },
      },
    },
    ringkas: (a) => `Membaca berkas: ${teksArg(a, "jalur")}`,
    jalankan: async (a, ctx) => {
      const hasil = await bacaBerkas(teksArg(a, "jalur"), ctx?.mintaIzin);
      // Kegagalan dikembalikan sebagai TEKS, bukan lemparan: alat yang
      // melempar menghentikan seluruh giliran agen, sedangkan alat yang
      // menjawab "tidak bisa karena X" membiarkan model membaca alasannya
      // dan memberi tahu penggunanya.
      return hasil.ok ? hasil.teks : hasil.pesan;
    },
  },

  {
    skema: {
      type: "function",
      function: {
        name: "sumber_terpakai",
        description:
          "Berkas korpus mana yang paling sering benar-benar menjawab pertanyaan Veldan sejauh ini. " +
          "Pakai untuk menjawab 'materi apa yang paling berguna' atau 'apa yang jarang kupakai'.",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    ringkas: () => "Melihat riwayat sumber terpakai",
    jalankan: () => {
      try {
        const r = ringkasSumber();
        if (r.length === 0) return "Belum ada sumber yang pernah tercatat.";
        return r
          .slice(0, 20)
          .map((s) => `${s.berkas}: ${s.jumlah}x (terakhir untuk "${s.contohKueri}")`)
          .join("\n");
      } catch (e) {
        return `Riwayat sumber gagal dibaca: ${(e as Error).message}`;
      }
    },
  },
];

export const SKEMA_ALAT: SkemaAlat[] = DAFTAR.map((a) => a.skema);

export function adaAlat(nama: string): boolean {
  return DAFTAR.some((a) => a.skema.function.name === nama);
}

/** Ringkasan satu baris untuk ditampilkan, sebelum alatnya dijalankan. */
export function ringkasPanggilan(nama: string, argumenJson: string): string {
  const alat = DAFTAR.find((a) => a.skema.function.name === nama);
  if (!alat) return `Alat tidak dikenal: ${nama}`;
  return alat.ringkas(uraiArgumen(argumenJson));
}

/**
 * Urai argumen dari model.
 *
 * Model kerap mengirim JSON yang sedikit cacat — koma menggantung, string yang
 * belum ditutup. Objek kosong adalah pemulihan yang benar: alat akan melihat
 * argumen yang hilang dan mengembalikan "kueri kosong", yang bisa dibaca model
 * dan diperbaiki di giliran berikutnya. Melempar di sini akan mematikan
 * seluruh percakapan karena satu koma.
 */
function uraiArgumen(json: string): Record<string, unknown> {
  try {
    const v = JSON.parse(json || "{}");
    return typeof v === "object" && v !== null && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function jalankanAlat(
  nama: string,
  argumenJson: string,
  ctx?: KonteksAlat,
): Promise<string> {
  const alat = DAFTAR.find((a) => a.skema.function.name === nama);
  if (!alat) {
    // Model kadang mengarang nama alat. Dijawab sebagai HASIL, bukan galat,
    // supaya ia bisa membaca daftar yang benar dan mencoba lagi.
    return `Alat "${nama}" tidak ada. Yang tersedia: ${SKEMA_ALAT.map((s) => s.function.name).join(", ")}.`;
  }
  try {
    return await alat.jalankan(uraiArgumen(argumenJson), ctx);
  } catch (e) {
    return `Alat "${nama}" gagal: ${(e as Error).message}`;
  }
}
