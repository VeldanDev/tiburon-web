// @vitest-environment jsdom
import { StrictMode } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import HalamanObrolan from "@/app/app/page";

afterEach(() => vi.unstubAllGlobals());

function aliranJawaban(teks: string) {
  const body = new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ jenis: "teks", teks })}\n`));
      c.close();
    },
  });
  return new Response(body, { status: 200 });
}

/**
 * Stub yang membedakan tiap panggilan ke /api/percakapan menurut METODENYA.
 *
 * GET mengambil daftar, POST membuat percakapan, PUT menyimpan satu pesan --
 * dan yang sedang diuji di sini cuma PUT. Stub yang menyamaratakan ketiganya
 * akan membuat percakapannya gagal dibuat lebih dulu, dan uji ini lulus karena
 * alasan yang salah.
 */
function stubFetch(putGagal: () => Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (masuk: RequestInfo | URL, opsi?: RequestInit) => {
      const url = String(masuk);
      if (url.includes("/api/percakapan")) {
        const metode = opsi?.method ?? "GET";
        if (metode === "POST") return new Response(JSON.stringify({ id: "p1" }), { status: 200 });
        if (metode === "PUT") return putGagal();
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.includes("/api/cepat")) return aliranJawaban("hai");
      return new Response(JSON.stringify({}), { status: 200 });
    }),
  );
}

async function kirim(teks: string) {
  fireEvent.change(screen.getByRole("textbox"), { target: { value: teks } });
  fireEvent.click(screen.getByRole("button", { name: /kirim pesan/i }));
}

describe("penyimpanan yang gagal harus terlihat", () => {
  it("PUT ditolak server → spanduk muncul dan menyebut akibatnya", async () => {
    // Inti perbaikannya. Sebelum ini, `simpan` diakhiri `.catch(() => {})`:
    // percakapan terlihat baik-baik saja sampai halaman dimuat ulang, lalu
    // kosong, tanpa satu pun petunjuk kapan atau kenapa.
    stubFetch(() => new Response(JSON.stringify({ pesan: "basis data terkunci" }), { status: 500 }));
    render(<HalamanObrolan />);

    await kirim("halo");

    const spanduk = await screen.findByText(/tidak tersimpan/i);
    expect(spanduk.textContent).toMatch(/basis data terkunci/i);
    // Akibatnya disebut, bukan cuma kegagalannya: yang di layar masih terbaca,
    // yang hilang adalah setelah dimuat ulang.
    expect(spanduk.textContent).toMatch(/dimuat ulang/i);
  });

  it("PUT melempar → tetap dilaporkan, bukan ditelan diam-diam", async () => {
    stubFetch(() => {
      throw new Error("jaringan putus");
    });
    render(<HalamanObrolan />);

    await kirim("halo");

    expect((await screen.findByText(/tidak tersimpan/i)).textContent).toMatch(/jaringan putus/i);
  });

  it("spanduk hilang begitu penyimpanan berikutnya berhasil", async () => {
    // Gagal sekali karena jaringan tersendat lalu pulih tidak boleh
    // meninggalkan peringatan yang menetap selamanya -- peringatan yang tidak
    // pernah hilang akan berhenti dibaca orang.
    let gagal = true;
    stubFetch(() =>
      gagal
        ? new Response(JSON.stringify({ pesan: "sesaat" }), { status: 500 })
        : new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    render(<HalamanObrolan />);

    await kirim("satu");
    await screen.findByText(/tidak tersimpan/i);

    gagal = false;
    await kirim("dua");

    await waitFor(() => {
      expect(screen.queryByText(/tidak tersimpan/i)).toBeNull();
    });
  });

  it("menyimpan pesan pengguna sekali, bukan dua kali", async () => {
    // Penyimpanan jawaban dipicu dari dalam fungsi pembaru setPesan, dan React
    // boleh memanggil fungsi itu lebih dari sekali. Riwayat ganda tidak pernah
    // terlihat sampai percakapannya dibuka lagi.
    stubFetch(() => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    // StrictMode-lah yang membuat uji ini berarti: di luar mode ketat, fungsi
    // pembaru hanya dipanggil sekali, jadi ujinya akan lulus bahkan tanpa
    // penjaganya -- dan uji yang lulus tanpa perbaikannya tidak menjaga apa pun.
    render(
      <StrictMode>
        <HalamanObrolan />
      </StrictMode>,
    );

    await kirim("halo");

    await waitFor(() => {
      const panggilan = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
      const put = panggilan.filter(
        (c) =>
          String(c[0]).includes("/api/percakapan") &&
          (c[1] as RequestInit | undefined)?.method === "PUT",
      );
      const isi = put.map((c) => JSON.parse(String((c[1] as RequestInit).body)));
      expect(isi.filter((b) => b.pesan.role === "user")).toHaveLength(1);
      expect(isi.filter((b) => b.pesan.role === "assistant")).toHaveLength(1);
    });
  });
});
