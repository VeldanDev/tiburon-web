import { describe, it, expect } from "vitest";
import { kenaliArtefak, artefakPercakapan, ekstensiUntuk, AMBANG_BARIS } from "@/lib/artefak";

const panjang = (n: number, isi = "baris") =>
  Array.from({ length: n }, (_, i) => `${isi} ${i}`).join("\n");

describe("kenaliArtefak", () => {
  it("mengabaikan blok pendek — cuplikan lebih enak dibaca di tempatnya", () => {
    expect(kenaliArtefak("```ts\nconst a = 1;\n```")).toHaveLength(0);
  });

  it("mengenali blok yang panjangnya melewati ambang", () => {
    const a = kenaliArtefak("```ts\n" + panjang(AMBANG_BARIS) + "\n```");
    expect(a).toHaveLength(1);
    expect(a[0].baris).toBe(AMBANG_BARIS);
  });

  // Pagar yang belum tertutup berarti jawabannya MASIH MENGALIR. Memunculkan
  // artefak setengah jadi membuat panel berubah isi di tiap potongan teks.
  it("mengabaikan blok yang pagarnya belum tertutup", () => {
    expect(kenaliArtefak("```ts\n" + panjang(30))).toHaveLength(0);
  });

  it("mengambil judul dari nama berkas di komentar", () => {
    const a = kenaliArtefak("```ts\n// app/api/radar/route.ts\n" + panjang(20) + "\n```");
    expect(a[0].judul).toBe("app/api/radar/route.ts");
  });

  it("jatuh ke nama fungsi kalau tidak ada komentar berkas", () => {
    const a = kenaliArtefak("```py\ndef hitungKedalaman(x):\n" + panjang(20) + "\n```");
    expect(a[0].judul).toBe("hitungKedalaman");
  });

  // Id berbasis posisi membuat chip dan panel memberi nomor yang tidak cocok:
  // chip membuka artefak yang salah, atau tidak membuka apa pun.
  it("memberi id yang SAMA untuk isi yang sama, di panggilan terpisah", () => {
    const teks = "```ts\n" + panjang(20) + "\n```";
    expect(kenaliArtefak(teks)[0].id).toBe(kenaliArtefak(teks)[0].id);
  });

  it("memberi id berbeda untuk isi berbeda", () => {
    const a = kenaliArtefak("```ts\n" + panjang(20, "satu") + "\n```")[0];
    const b = kenaliArtefak("```ts\n" + panjang(20, "dua") + "\n```")[0];
    expect(a.id).not.toBe(b.id);
  });
});

describe("artefakPercakapan", () => {
  it("melewati pesan pengguna — lampiran juga berpagar ```", () => {
    const hasil = artefakPercakapan([
      { peran: "user", isi: "```ts\n" + panjang(30) + "\n```\napa ini?" },
      { peran: "assistant", isi: "ini kodenya" },
    ]);
    expect(hasil).toHaveLength(0);
  });

  // Model kerap menulis ulang seluruh berkas setelah satu perbaikan kecil.
  it("tidak mengulang artefak yang isinya identik", () => {
    const blok = "```ts\n" + panjang(20) + "\n```";
    const hasil = artefakPercakapan([
      { peran: "assistant", isi: blok },
      { peran: "assistant", isi: `sudah kuperbaiki:\n${blok}` },
    ]);
    expect(hasil).toHaveLength(1);
  });

  it("mengumpulkan artefak berbeda dari beberapa balasan", () => {
    const hasil = artefakPercakapan([
      { peran: "assistant", isi: "```ts\n" + panjang(20, "a") + "\n```" },
      { peran: "assistant", isi: "```py\n" + panjang(20, "b") + "\n```" },
    ]);
    expect(hasil).toHaveLength(2);
  });
});

describe("ekstensiUntuk", () => {
  it.each([
    ["typescript", "ts"],
    ["python", "py"],
    ["bash", "sh"],
    ["json", "json"],
    ["", "txt"],
  ])("%s -> .%s", (bahasa, harap) => {
    expect(ekstensiUntuk(bahasa)).toBe(harap);
  });

  // Bahasa yang aneh tidak boleh jadi nama berkas yang aneh.
  it("menolak nilai yang tidak layak jadi ekstensi", () => {
    expect(ekstensiUntuk("../../etc/passwd")).toBe("txt");
  });
});
