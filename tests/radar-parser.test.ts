import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { bacaRadar } from "@/lib/radar-parser";

const DIR_ASLI = "D:\\vscode\\MyProjects\\Otak\\radar";

describe("bacaRadar", () => {
  it("mengembalikan null kalau berkas hari itu belum ada", () => {
    expect(bacaRadar(new Date("1999-01-01"), DIR_ASLI)).toBeNull();
  });

  it("mengurai laporan sungguhan 2026-09-03", () => {
    const berkas = path.join(DIR_ASLI, "2026-09-03.md");
    if (!fs.existsSync(berkas)) return; // berkas sungguhan mungkin sudah dirotasi
    const laporan = bacaRadar(new Date("2026-09-03"), DIR_ASLI)!;
    expect(laporan.berita.length).toBeGreaterThan(20);
    expect(laporan.github.length).toBeGreaterThan(5);
    expect(laporan.berita[0].judul).toBeTruthy();
    expect(laporan.berita[0].url).toMatch(/^https?:\/\//);
  });

  it("menangkap catatan relevansi proyek pada item yang punya", () => {
    const tiruan = path.join(os.tmpdir(), `radar-uji-${Date.now()}`);
    fs.mkdirSync(tiruan, { recursive: true });
    fs.writeFileSync(path.join(tiruan, "2026-01-01.md"), [
      "# Radar Pagi — 2026-01-01", "",
      "## Berita teknologi dunia (2)", "",
      "1. **[Chip]** Judul pertama",
      "   Ringkasan pertama.",
      "   _TechCrunch_ — https://contoh.test/a",
      "   **Untuk proyek kita:** alasan relevansi.", "",
      "2. **[AI]** Judul kedua",
      "   Ringkasan kedua.",
      "   _Wired_ — https://contoh.test/b", "",
      "## GitHub Trending (1)", "",
      "3. **pemilik/repo** — Python, 100 bintang",
      "   Ringkasan repo.",
      "   https://github.com/pemilik/repo", "",
    ].join("\n"), "utf8");

    const l = bacaRadar(new Date("2026-01-01"), tiruan)!;
    expect(l.berita).toHaveLength(2);
    expect(l.berita[0].kategori).toBe("Chip");
    expect(l.berita[0].relevan).toBe("alasan relevansi.");
    expect(l.berita[1].relevan).toBeUndefined();
    expect(l.github).toHaveLength(1);
    expect(l.github[0].judul).toContain("pemilik/repo");
    fs.rmSync(tiruan, { recursive: true, force: true });
  });
});
