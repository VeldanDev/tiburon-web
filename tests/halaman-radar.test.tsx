// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import HalamanRadar from "@/app/app/radar/page";

afterEach(() => vi.unstubAllGlobals());

function responsJSON(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status });
}

describe("HalamanRadar — tiga keadaan harus terlihat, bukan diam-diam kosong", () => {
  it("berkas ADA tapi bagian kosong → catatan tampil di DOM, bukan daftar kosong tanpa penjelasan", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        responsJSON({
          tanggal: "2026-08-31",
          berita: [],
          github: [],
          catatan:
            "Bagian berita teknologi dunia dan GitHub Trending pada radar 2026-08-31 tidak berisi satu item pun.",
        }),
      ),
    );
    render(<HalamanRadar />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });
    expect(screen.getByText(/tidak berisi satu item pun/)).toBeTruthy();
  });

  it("radar belum jalan (404) → pesan pukul 06:30 tampil di DOM", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        responsJSON(
          { pesan: "Radar untuk 2026-01-01 belum ada. Radar Pagi dijadwalkan tiap hari pukul 06:30 WIB." },
          404,
        ),
      ),
    );
    render(<HalamanRadar />);

    await waitFor(() => {
      expect(screen.getByText(/06:30 WIB/)).toBeTruthy();
    });
  });
});
