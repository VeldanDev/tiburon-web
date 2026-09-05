import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { jalankanAlat } from "@/lib/alat";
import { PENANDA } from "@/lib/redaksi";

/**
 * Penyuntingan dipasang di SATU titik yang dilewati semua alat, bukan di tiap
 * alat masing-masing. Uji ini menjaga titik itu: kalau pemasangannya dicabut,
 * kunci di dalam berkas yang boleh dibaca akan masuk ke percakapan lagi.
 *
 * Lubang yang ditutupnya nyata: lapisan izin menolak `.env.local` berdasarkan
 * NAMANYA, dan dengan benar mengizinkan `config.json` — tapi kunci yang
 * kebetulan ada di dalam `config.json` sama berbahayanya.
 */
const KOTAK = path.join(process.cwd(), "data", "uji-redaksi");
const KUNCI_PALSU = "ghp_" + "0123456789abcdefghij0123456789";

beforeEach(() => fs.mkdirSync(KOTAK, { recursive: true }));
afterEach(() => {
  try {
    fs.rmSync(KOTAK, { recursive: true, force: true });
  } catch {
    // folder sementara tidak wajib bersih
  }
});

describe("jalankanAlat menyunting rahasia dari hasil alat", () => {
  it("kunci di dalam berkas yang BOLEH dibaca tidak ikut ke percakapan", async () => {
    const berkas = path.join(KOTAK, "config.json");
    fs.writeFileSync(berkas, JSON.stringify({ nama: "tiburon", token: KUNCI_PALSU }, null, 2));

    const hasil = await jalankanAlat("baca_berkas", JSON.stringify({ jalur: berkas }));

    expect(hasil).not.toContain(KUNCI_PALSU);
    expect(hasil).toContain(PENANDA);
    // Sisa berkasnya tetap terbaca: yang disunting rahasianya, bukan isinya.
    expect(hasil).toContain("tiburon");
  });

  it("hasil alat tanpa rahasia lewat tanpa berubah", async () => {
    const berkas = path.join(KOTAK, "catatan.md");
    fs.writeFileSync(berkas, "# Catatan\n\nTidak ada apa-apa di sini.");

    const hasil = await jalankanAlat("baca_berkas", JSON.stringify({ jalur: berkas }));

    expect(hasil).toContain("Tidak ada apa-apa di sini.");
    expect(hasil).not.toContain(PENANDA);
  });
});
