// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import HalamanObrolan from "@/app/app/page";

afterEach(() => vi.unstubAllGlobals());

function responsSSE(baris: string[]) {
  const body = new ReadableStream({
    start(c) {
      for (const b of baris) c.enqueue(new TextEncoder().encode(b));
      c.close();
    },
  });
  return new Response(body, { status: 200 });
}

/**
 * Stub fetch yang MENGENALI URL, bukan urutan panggilan.
 *
 * Halaman ini memanggil dua endpoint berbeda dalam satu kali kirim:
 * `/api/percakapan` untuk menyimpan riwayat, lalu `/api/cepat` untuk
 * jawabannya. Stub berbasis urutan membuat panggilan riwayat memakan jatah
 * balasan milik chat -- dan lebih buruk lagi, sebuah Response ber-stream
 * hanya bisa dibaca SEKALI, jadi objek yang sama tidak bisa dipakai ulang.
 *
 * `chat` berupa fungsi supaya tiap pemanggilan mendapat stream yang segar.
 */
function stubFetch(chat: () => Response | Promise<Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (masuk: RequestInfo | URL) => {
      const url = String(masuk);
      if (url.includes("/api/percakapan")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return chat();
    }),
  );
}

async function kirimPesan(teks: string) {
  // Dicari lewat PERAN, bukan lewat teks placeholder. Uji yang pecah tiap
  // kali copy diubah akan diabaikan orang, dan uji yang diabaikan tidak
  // menjaga apa pun.
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: teks },
  });
  fireEvent.click(screen.getByRole("button", { name: /kirim pesan/i }));
}

function tombolKirim(): HTMLButtonElement {
  return screen.getByRole("button", { name: /kirim pesan/i }) as HTMLButtonElement;
}

/**
 * Membuktikan layar benar-benar PULIH setelah kegagalan.
 *
 * Memeriksa `tombolKirim().disabled === false` saja tidak cukup: sesudah
 * dikirim, kotak teks dikosongkan, jadi tombolnya memang mati karena tidak
 * ada yang bisa dikirim -- bukan karena terkunci. Yang membedakan keduanya
 * adalah apakah mengetik lagi menghidupkannya kembali.
 */
async function pastikanPulih() {
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "lagi" } });
  await waitFor(() => {
    expect(tombolKirim().disabled).toBe(false);
  });
}

describe("HalamanObrolan — kegagalan tidak boleh mengunci layar", () => {
  it("fetch melempar → input tidak terkunci selamanya dan galat terlihat", async () => {
    stubFetch(() => {
      throw new Error("jaringan putus");
    });
    render(<HalamanObrolan />);

    await kirimPesan("halo");

    await waitFor(() => {
      expect(screen.getByText(/jaringan putus/)).toBeTruthy();
    });
    await pastikanPulih();
  });

  it("server membalas 500 → pesan galat menyebut statusnya", async () => {
    stubFetch(() => new Response("meledak", { status: 500 }));
    render(<HalamanObrolan />);

    await kirimPesan("halo");

    await waitFor(() => {
      expect(screen.getByText(/500/)).toBeTruthy();
    });
    await pastikanPulih();
  });

  it("kejadian gagal setelah teks parsial → teks parsial tetap ada", async () => {
    stubFetch(() =>
      responsSSE([
        `data: ${JSON.stringify({ jenis: "teks", teks: "jawaban separuh jalan" })}\n\n`,
        `data: ${JSON.stringify({ jenis: "gagal", pesan: "model cadangan juga gagal" })}\n\n`,
        `data: ${JSON.stringify({ jenis: "selesai" })}\n\n`,
      ]),
    );
    render(<HalamanObrolan />);

    await kirimPesan("halo");

    await waitFor(() => {
      expect(screen.getByText(/model cadangan juga gagal/)).toBeTruthy();
    });
    expect(screen.getByText(/jawaban separuh jalan/)).toBeTruthy();
  });
});
