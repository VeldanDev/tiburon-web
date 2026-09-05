import { describe, it, expect } from "vitest";
import { ANGGARAN, muatkan, taksirToken, tokenPesan, type PesanMuat } from "@/lib/muat";
import { susunPrompt } from "@/lib/penyedia";

/** Pesan pengguna dengan panjang yang bisa diatur, supaya anggarannya terkendali. */
function u(teks: string, panjang = 0): PesanMuat {
  return { role: "user", content: teks + "x".repeat(panjang) };
}
function a(teks: string, panjang = 0): PesanMuat {
  return { role: "assistant", content: teks + "x".repeat(panjang) };
}
const sistem: PesanMuat = { role: "system", content: "persona" };

/** Percakapan n giliran, tiap giliran kira-kira `besar` karakter. */
function percakapan(n: number, besar: number): PesanMuat[] {
  const ps: PesanMuat[] = [sistem];
  for (let i = 1; i <= n; i++) {
    ps.push(u(`tanya-${i} `, besar / 2), a(`jawab-${i} `, besar / 2));
  }
  return ps;
}

describe("muatkan — yang muat tidak disentuh", () => {
  it("percakapan pendek dikembalikan persis apa adanya", () => {
    const ps = percakapan(3, 100);
    const h = muatkan(ps);
    expect(h.dibuang).toBe(0);
    // Objek yang sama, bukan salinan yang setara: tidak ada yang perlu disalin
    // kalau tidak ada yang berubah.
    expect(h.pesan).toBe(ps);
  });

  it("percakapan kosong tidak melempar", () => {
    expect(muatkan([]).dibuang).toBe(0);
    expect(muatkan([sistem]).dibuang).toBe(0);
  });
});

describe("muatkan — yang tidak muat", () => {
  it("membuang giliran terlama lebih dulu, menyimpan yang terbaru", () => {
    const h = muatkan(percakapan(40, 20_000), 60_000);
    expect(h.dibuang).toBeGreaterThan(0);

    const teks = h.pesan.map((p) => p.content ?? "").join("\n");
    // Yang baru saja dibicarakan hampir selalu lebih menentukan jawabannya
    // daripada yang dibicarakan dua jam lalu.
    expect(teks).toContain("tanya-40");
    expect(teks).not.toContain("tanya-1 ");
  });

  it("hasilnya benar-benar di bawah anggaran", () => {
    const anggaran = 40_000;
    const h = muatkan(percakapan(60, 15_000), anggaran);
    const nyata = h.pesan.reduce((n, p) => n + tokenPesan(p), 0);
    expect(nyata).toBeLessThanOrEqual(anggaran);
    // Yang dilaporkan sama dengan yang sebenarnya: angka yang dipakai untuk
    // memutuskan harus angka yang sama dengan yang dikirim.
    expect(h.token).toBe(nyata);
  });

  it("menyebutkan yang dibuang, tidak menghilangkannya senyap", () => {
    // Model yang tidak tahu ada bagian yang hilang akan menjawab seolah ia
    // sudah membaca semuanya — persis kegagalan yang sedang dihindari.
    const h = muatkan(percakapan(40, 20_000), 60_000);
    const catatan = h.pesan.find(
      (p) => p.role === "system" && (p.content ?? "").includes("dihilangkan"),
    );
    expect(catatan).toBeTruthy();
    expect(catatan!.content).toContain(String(h.dibuang));
  });

  it("catatannya duduk di antara pesan sistem dan percakapan yang tersisa", () => {
    // Ditaruh di lubang tempat yang dibuang tadi berada, supaya urutannya
    // tetap terbaca sebagai satu garis waktu.
    const h = muatkan(percakapan(40, 20_000), 60_000);
    expect(h.pesan[0].content).toBe("persona");
    expect(h.pesan[1].content).toContain("dihilangkan");
    expect(h.pesan[2].role).toBe("user");
  });
});

describe("muatkan — aturan yang tidak boleh dilanggar", () => {
  it("SELURUH pesan sistem dipertahankan, walau percakapannya kelewat besar", () => {
    // Di dalamnya ada persona, instruksi, ingatan, dan potongan korpus.
    // Membuangnya berarti menjawab sebagai orang lain dengan bahan berbeda.
    const ps: PesanMuat[] = [
      { role: "system", content: "persona" },
      { role: "system", content: "instruksi khusus" },
      ...percakapan(30, 20_000).slice(1),
    ];
    const h = muatkan(ps, 30_000);
    expect(h.pesan[0].content).toBe("persona");
    expect(h.pesan[1].content).toBe("instruksi khusus");
  });

  it("giliran terakhir tetap ikut walau ia sendirian melebihi anggaran", () => {
    // Mengirim percakapan tanpa pertanyaan terakhirnya berarti menjawab
    // pertanyaan yang salah; lebih baik gagal jujur daripada berhasil
    // menjawab hal lain.
    const h = muatkan(percakapan(10, 200_000), 5_000);
    const teks = h.pesan.map((p) => p.content ?? "").join("\n");
    expect(teks).toContain("tanya-10");
    expect(h.dibuang).toBe(9);
  });

  it("tidak pernah menyisakan jawaban tanpa pertanyaannya", () => {
    // Model yang melihat dirinya menjawab sesuatu yang tak pernah ditanyakan
    // akan mencoba menjelaskan jawaban yang bukan miliknya.
    const h = muatkan(percakapan(30, 20_000), 60_000);
    const percakapanSaja = h.pesan.filter((p) => p.role !== "system");
    expect(percakapanSaja[0].role).toBe("user");
  });

  it("hasil alat tidak pernah terpisah dari panggilan yang memicunya", () => {
    // API menolak pesan `tool` yang tidak punya panggilan pasangannya —
    // memisahkannya bukan cuma membingungkan, tapi galat mentah.
    const ps: PesanMuat[] = [sistem];
    for (let i = 1; i <= 20; i++) {
      ps.push(
        u(`tanya-${i} `, 10_000),
        { role: "assistant", content: null, tool_calls: [{ id: `c${i}`, nama: "cari" }] },
        { role: "tool", tool_call_id: `c${i}`, content: "hasil ".repeat(2000) },
        a(`jawab-${i} `, 5_000),
      );
    }
    const h = muatkan(ps, 40_000);

    const idPanggilan = new Set(
      h.pesan
        .filter((p) => p.tool_calls)
        .flatMap((p) => (p.tool_calls as { id: string }[]).map((c) => c.id)),
    );
    for (const p of h.pesan) {
      if (p.role === "tool") {
        expect(idPanggilan.has(p.tool_call_id as string), `yatim: ${p.tool_call_id}`).toBe(true);
      }
    }
  });
});

describe("tokenPesan", () => {
  it("menghitung argumen panggilan alat, bukan cuma isinya", () => {
    // Pesan ber-`content` null yang membawa panggilan besar akan terhitung
    // nyaris nol kalau hanya `content` yang dilihat — lalu taksirannya meleset
    // ke arah yang salah, yaitu mengira masih muat.
    const kosong: PesanMuat = { role: "assistant", content: null };
    const berat: PesanMuat = {
      role: "assistant",
      content: null,
      tool_calls: [{ id: "c1", argumen: "x".repeat(4000) }],
    };
    expect(tokenPesan(berat)).toBeGreaterThan(tokenPesan(kosong) + 1000);
  });

  it("ongkos tetap tiap pesan ikut dihitung", () => {
    // Kecil per pesan, tapi pada percakapan 200 pesan ia jadi ribuan token.
    expect(tokenPesan({ role: "user", content: "" })).toBeGreaterThan(0);
  });
});

describe("taksirToken", () => {
  it("nol untuk teks kosong", () => {
    expect(taksirToken("")).toBe(0);
  });

  it("naik seiring panjangnya", () => {
    expect(taksirToken("x".repeat(3600))).toBe(1000);
  });
});

describe("ANGGARAN", () => {
  it("menyisakan ruang untuk jawabannya sendiri", () => {
    // Jendela dipakai bersama oleh yang masuk DAN yang keluar; mengisinya
    // sampai penuh menghasilkan jawaban yang terpotong di tengah kalimat.
    expect(ANGGARAN).toBeLessThan(128_000);
  });
});


describe("pemasangannya di jalur obrolan", () => {
  it("susunPrompt tidak pernah mengembalikan percakapan yang melebihi anggaran", () => {
    // Uji ini menjaga TITIK PASANGNYA, bukan modulnya. Kalau pemangkasnya
    // dicabut dari susunPrompt, percakapan panjang akan dikirim utuh lagi dan
    // gagal dengan pesan tentang batas token yang tidak menyebut satu pun hal
    // yang bisa dilakukan Veldan.
    const panjang = Array.from({ length: 80 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `pesan-${i} ` + "x".repeat(20_000),
    }));

    const siap = susunPrompt(panjang, []);
    const token = siap.reduce((n, p) => n + tokenPesan(p), 0);
    expect(token).toBeLessThanOrEqual(ANGGARAN);

    // Dan yang tersisa adalah bagian TERBARU, bukan potongan sembarang.
    expect(siap[siap.length - 1].content).toContain("pesan-79");
  });

  it("percakapan pendek lewat susunPrompt tanpa catatan pemangkasan", () => {
    const siap = susunPrompt([{ role: "user", content: "halo" }], []);
    expect(siap.some((p) => (p.content ?? "").includes("dihilangkan"))).toBe(false);
  });
});
