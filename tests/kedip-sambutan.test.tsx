// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import HalamanObrolan from "@/app/app/page";

afterEach(() => vi.unstubAllGlobals());

/**
 * Menahan balasan riwayat sampai uji yang memintanya.
 *
 * Inti masalahnya hidup TEPAT di jendela ini: antara halaman muncul dan
 * riwayatnya sampai. Stub yang membalas seketika menutup jendela itu, dan
 * ujinya jadi lulus tanpa pernah memeriksa apa pun.
 */
function stubTertahan(daftar: unknown[], isi: unknown[]) {
  let lepas!: () => void;
  const tertahan = new Promise<void>((r) => (lepas = r));

  vi.stubGlobal(
    "fetch",
    vi.fn(async (masuk: RequestInfo | URL) => {
      const url = String(masuk);
      if (url.includes("/api/percakapan?id=")) {
        await tertahan;
        return new Response(JSON.stringify(isi), { status: 200 });
      }
      if (url.includes("/api/percakapan")) {
        await tertahan;
        return new Response(JSON.stringify(daftar), { status: 200 });
      }
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
      return new Response(JSON.stringify([]), { status: 200 });
    }),
  );

  return () => lepas();
}

describe("layar sambutan tidak boleh berkedip saat memuat", () => {
  it("selama riwayat dimuat, tidak ada yang menyatakan obrolannya kosong", async () => {
    // Sebelum perbaikan, `pesan` mulai dari [] dan layar sambutan langsung
    // dirender penuh -- terukur ~120 ms di browser sungguhan. Sepersekian detik
    // itu memberi tahu pemiliknya bahwa obrolannya tidak ada, tepat saat ia
    // menekan F5 untuk memastikan obrolannya ada.
    const lepas = stubTertahan(
      [{ id: "p1", judul: "Hai", diperbarui: Date.now(), disemat: false }],
      [{ role: "user", content: "hai" }],
    );

    render(<HalamanObrolan />);

    expect(screen.queryByText(/Tiburon siap/i)).toBeNull();
    expect(screen.queryByText(/Apa isi radar pagi ini\?/i)).toBeNull();
    // Kotak ketik TETAP ada selama memuat: komposer yang lenyap sekejap tiap
    // muat ulang lebih mengganggu daripada kerangka.
    expect(screen.queryByRole("textbox")).not.toBeNull();

    lepas();
    await waitFor(() => {
      expect(screen.getByText("hai")).toBeTruthy();
    });
    // Dan sesudahnya pun tidak pernah muncul: yang datang adalah percakapannya.
    expect(screen.queryByText(/Tiburon siap/i)).toBeNull();
  });

  it("kosong yang SUNGGUHAN tetap menampilkan sambutan", async () => {
    // Penjaga arah sebaliknya. Menyembunyikan sambutan selamanya "menyelesaikan"
    // kedipannya juga, dan itu akan meninggalkan pengguna baru menatap kerangka
    // tanpa ujung.
    const lepas = stubTertahan([], []);
    render(<HalamanObrolan />);

    expect(screen.queryByText(/Tiburon siap/i)).toBeNull();

    lepas();
    await waitFor(() => {
      expect(screen.getByText(/Tiburon siap/i)).toBeTruthy();
    });
    expect(screen.getByText(/Apa isi radar pagi ini\?/i)).toBeTruthy();
  });
});
