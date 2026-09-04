// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * Berapa kali markdown dirender ulang selama satu jawaban mengalir?
 *
 * Tiap potongan token yang datang menyetel ulang state, dan tanpa memoisasi
 * SETIAP pesan di layar ikut dirender ulang — masing-masing memarsing ulang
 * markdown-nya dari awal. Biayanya tumbuh sebagai (jumlah pesan × jumlah
 * potongan), dan yang merasakannya justru percakapan yang paling berguna:
 * yang sudah panjang.
 *
 * Uji ini menghitungnya, bukan menebaknya.
 */

let dirender = 0;

// react-markdown diganti pencatat: yang diukur adalah berapa kali komponennya
// dipanggil, bukan hasil renderannya.
vi.mock("react-markdown", () => ({
  default: ({ children }: { children?: string }) => {
    dirender++;
    return <div data-uji="md">{children}</div>;
  },
}));
vi.mock("remark-gfm", () => ({ default: () => {} }));

const { default: HalamanObrolan } = await import("@/app/app/page");

const POTONGAN = 30;
const PESAN_LAMA = 8;

function aliran() {
  return new Response(
    new ReadableStream({
      async start(c) {
        for (let i = 0; i < POTONGAN; i++) {
          // Jeda satu tugas antar-potongan. Tanpa ini semuanya tiba dalam satu
          // gelombang, React membatch-nya jadi satu render, dan ukurannya tidak
          // menggambarkan aliran sungguhan sama sekali.
          await new Promise((r) => setTimeout(r, 0));
          c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ jenis: "teks", teks: `kata${i} ` })}
`));
        }
        c.close();
      },
    }),
    { status: 200 },
  );
}

function stub() {
  const lama = Array.from({ length: PESAN_LAMA }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `pesan lama nomor ${i}`,
  }));

  vi.stubGlobal(
    "fetch",
    vi.fn(async (masuk: RequestInfo | URL, opsi?: RequestInit) => {
      const url = String(masuk);
      if (url.includes("/api/cepat")) return aliran();
      if (url.includes("/api/percakapan?id=")) return new Response(JSON.stringify(lama), { status: 200 });
      if (url.includes("/api/percakapan")) {
        if ((opsi?.method ?? "GET") === "GET") {
          return new Response(
            JSON.stringify([{ id: "p1", judul: "Panjang", diperbarui: Date.now(), disemat: false }]),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ id: "p1", ok: true }), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }),
  );
}

beforeEach(() => {
  dirender = 0;
});
afterEach(() => vi.unstubAllGlobals());

describe("render saat jawaban mengalir", () => {
  it("pesan yang sudah selesai tidak ikut dirender ulang tiap potongan", async () => {
    stub();
    render(<HalamanObrolan />);

    // Tunggu riwayat lama tampil, lalu nolkan hitungan: yang diukur hanya
    // render yang terjadi SELAMA jawaban mengalir.
    await waitFor(() => {
      expect(document.querySelectorAll('[data-uji="md"]').length).toBeGreaterThan(0);
    });
    dirender = 0;

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "tanya" } });
    fireEvent.click(screen.getByRole("button", { name: /kirim pesan/i }));

    await waitFor(() => {
      expect(document.body.textContent).toContain(`kata${POTONGAN - 1}`);
    });

    /*
     * Batasnya diturunkan dari bentuk masalahnya, bukan dari angka yang
     * kebetulan lolos hari ini.
     *
     * Tanpa memoisasi, tiap potongan merender ulang seluruh jawaban asisten di
     * layar: ~POTONGAN × (jawaban lama + 1). Dengan memoisasi, hanya jawaban
     * yang sedang tumbuh yang berubah, jadi angkanya mendekati POTONGAN saja.
     *
     * Ambangnya ditaruh di tengah keduanya supaya ia menangkap kembalinya
     * masalah tanpa pecah karena satu-dua render tambahan dari React.
     */
    console.log(`>>> markdown dirender ${dirender} kali untuk ${POTONGAN} potongan, ${PESAN_LAMA} pesan lama`);
    const tanpaMemo = POTONGAN * (PESAN_LAMA / 2 + 1);
    expect(dirender).toBeLessThan(tanpaMemo / 2);
  });
});
