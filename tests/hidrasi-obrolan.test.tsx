// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { act } from "react";
import HalamanObrolan from "@/app/app/page";

/**
 * Menangkap galat hidrasi yang sesungguhnya.
 *
 * `render()` biasa TIDAK bisa menemukan masalah ini: ia membangun DOM dari nol
 * di klien, jadi tidak pernah ada markup server untuk dibandingkan. Satu-
 * satunya cara adalah menempuh jalan yang sama seperti browser — render di
 * server jadi HTML, tempelkan HTML itu, lalu hidrasi di atasnya.
 *
 * BATASNYA: "server" di sini tetap berjalan di jsdom, jadi `window` ADA saat
 * renderToString. Cabang `typeof window === "undefined"` karena itu tidak akan
 * pernah tertangkap di sini -- padahal itu penyebab ketidakcocokan yang paling
 * umum. Yang dijaga uji ini adalah nilai atribut dan isi teks, dan itu sudah
 * diperiksa: menghapus disabled="" dari markup servernya membuatnya gagal
 * dengan pesan React yang persis sama.
 *
 * React melaporkan ketidakcocokan lewat console.error, bukan lewat lemparan,
 * jadi itu yang diintip.
 */

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

/**
 * Balasan palsu PER RUTE, bukan satu bentuk untuk semuanya.
 *
 * Layar kosong memanggil tiga rute dengan bentuk berbeda, dan stub yang
 * menyamaratakan ketiganya membuat komponen jatuh karena bentuk yang salah --
 * kegagalan lingkungan uji yang terbaca seperti kegagalan hidrasi.
 */
function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (masuk: RequestInfo | URL) => {
      const url = String(masuk);
      if (url.includes("/api/statistik")) {
        return new Response(
          JSON.stringify({
            percakapan: 0,
            pesan: 0,
            token: 0,
            hariAktif: 0,
            streakSaatIni: 0,
            streakTerpanjang: 0,
            jamPuncak: null,
            modelTeratas: [],
            jawabanTanpaModel: 0,
            harian: [],
            pembanding: null,
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/korpus/berkas")) {
        return new Response(JSON.stringify({ berkas: [], potongan: 0 }), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }),
  );
}

async function hidrasi(html: string) {
  const wadah = document.createElement("div");
  wadah.innerHTML = html;
  document.body.appendChild(wadah);

  const galat: string[] = [];
  const asli = console.error;
  vi.spyOn(console, "error").mockImplementation((...arg: unknown[]) => {
    galat.push(arg.map(String).join(" "));
    // Tetap diteruskan supaya kegagalan uji ini bisa dibaca lengkap saat
    // diperiksa manual; yang ditekan cuma kebisingannya, bukan isinya.
    if (process.env.HIDRASI_BERISIK) asli(...arg);
  });

  await act(async () => {
    hydrateRoot(wadah, <HalamanObrolan />);
  });

  return galat;
}

describe("layar obrolan tidak boleh gagal hidrasi", () => {
  it("markup server dan render klien pertama identik", async () => {
    // fetch dimatikan: yang diuji adalah render PERTAMA, sebelum data apa pun
    // datang. Kalau permintaan jaringan dibiarkan jalan, keadaan bisa berubah
    // di tengah hidrasi dan ujinya jadi tidak menentu.
    stubFetch();

    const html = renderToString(<HalamanObrolan />);

    // Prasyarat: markup servernya memang memuat komposer. Kalau renderToString
    // ternyata cuma menghasilkan kerangka Suspense, uji di bawahnya lulus
    // tanpa membandingkan apa pun.
    expect(html).toContain('aria-label="Kirim pesan"');

    const galat = await hidrasi(html);
    const hidrasiGagal = galat.filter((g) => /hydrat|did not match|mismatch/i.test(g));

    expect(hidrasiGagal).toEqual([]);
  });

  it("tombol kirim dirender mati di kedua sisi saat komposer kosong", async () => {
    // Inti galat yang dilaporkan: `disabled` pada tombol Kirim. Nilainya
    // diturunkan dari state `teks` yang selalu mulai kosong, jadi kedua sisi
    // WAJIB sepakat -- dan uji ini yang menjaga janji itu kalau nanti nilainya
    // diambil dari tempat lain (draf tersimpan, parameter URL, localStorage).
    stubFetch();

    const html = renderToString(<HalamanObrolan />);
    const potong = html.slice(html.indexOf('aria-label="Kirim pesan"') - 200);

    expect(potong).toMatch(/<button disabled=""[^>]*aria-label="Kirim pesan"/);
    expect(potong).toContain(">Kirim</button>");
  });
});
