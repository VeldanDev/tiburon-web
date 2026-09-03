import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const PALET = {
  "--abyss": "#060B14",
  "--deep": "#0B2545",
  "--ocean": "#14487F",
  "--surface": "#3FA9F5",
  "--foam": "#A8DCFB",
  "--shell": "#F4F9FD",
};

describe("token warna", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "styles/tokens.css"), "utf8");

  for (const [nama, nilai] of Object.entries(PALET)) {
    it(`${nama} bernilai ${nilai}`, () => {
      const cocok = css.match(new RegExp(`${nama}\\s*:\\s*([^;]+);`));
      expect(cocok, `${nama} tidak ada di tokens.css`).not.toBeNull();
      expect(cocok![1].trim().toUpperCase()).toBe(nilai.toUpperCase());
    });
  }

  it("mendefinisikan warna latar untuk tiap jalur", () => {
    for (const jalur of ["--latar-cepat", "--latar-tiburon", "--latar-kode"]) {
      expect(css, `${jalur} tidak ada`).toContain(jalur);
    }
  });
});
