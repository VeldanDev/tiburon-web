/**
 * Pewarnaan sintaks harus tetap berada di dalam palet Tiburon.
 *
 * Uji ini menyorot kode sungguhan lewat Shiki dan memeriksa setiap warna yang
 * keluar. Tanpa penjaga ini, satu suntingan pada TEMA bisa memasukkan warna
 * dari luar palet — dan blok kode adalah elemen yang paling menarik mata di
 * seluruh layar, jadi satu warna asing di sana terlihat lebih menonjol
 * daripada di mana pun.
 */
import { describe, it, expect } from "vitest";
import { createHighlighter } from "shiki";
import { TEMA } from "@/components/chat/BlokKode";

const PALET = ["#3FA9F5", "#A8DCFB", "#F4F9FD", "#5B7FA6", "#FFB454", "#FF5C63"];

const KODE = `// menyelam ke dasar
const hiu = "tiburon";
let kedalaman = 200;
function turun(m: number) { return m * 2; }`;

describe("tema Shiki Tiburon", () => {
  it("tidak memakai satu pun warna di luar palet", async () => {
    const h = await createHighlighter({ themes: [TEMA], langs: ["typescript"] });
    const html = h.codeToHtml(KODE, { lang: "typescript", theme: "tiburon" });

    // Lookbehind negatif: tanpa ini polanya ikut menangkap nilai di dalam
    // `background-color:`, dan uji ini akan menguji warna LATAR alih-alih
    // warna token yang sebenarnya jadi pokoknya.
    const dipakai = [
      ...new Set(
        [...html.matchAll(/(?<!background-)color:(#[0-9A-Fa-f]{6})/g)].map((m) =>
          m[1].toUpperCase(),
        ),
      ),
    ];

    expect(dipakai.length).toBeGreaterThan(2); // benar-benar mewarnai, bukan satu warna rata
    expect(dipakai.filter((w) => !PALET.includes(w))).toEqual([]);
  });

  it("memberi warna berbeda pada komentar, string, dan angka", async () => {
    const h = await createHighlighter({ themes: [TEMA], langs: ["typescript"] });
    const html = h.codeToHtml(KODE, { lang: "typescript", theme: "tiburon" });

    // Kalau ketiganya berwarna sama, pewarnaannya tidak menolong siapa pun.
    expect(html).toContain("#5B7FA6"); // komentar
    expect(html).toContain("#A8DCFB"); // string
    expect(html).toContain("#FFB454"); // angka
  });
});
