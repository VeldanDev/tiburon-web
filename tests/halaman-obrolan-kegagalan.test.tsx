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

async function kirimPesan(teks: string) {
  fireEvent.change(screen.getByPlaceholderText("Tanya apa saja…"), {
    target: { value: teks },
  });
  fireEvent.click(screen.getByRole("button"));
}

function tombolKirim(): HTMLButtonElement {
  return screen.getByRole("button") as HTMLButtonElement;
}

describe("HalamanObrolan — kegagalan tidak boleh mengunci layar", () => {
  it("fetch melempar → input tidak terkunci selamanya dan galat terlihat", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("jaringan putus")));
    render(<HalamanObrolan />);

    await kirimPesan("halo");

    await waitFor(() => {
      expect(tombolKirim().disabled).toBe(false);
    });
    expect(screen.getByText(/jaringan putus/)).toBeTruthy();
  });

  it("server membalas 500 → pesan galat menyebut statusnya", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("meledak", { status: 500 })),
    );
    render(<HalamanObrolan />);

    await kirimPesan("halo");

    await waitFor(() => {
      expect(tombolKirim().disabled).toBe(false);
    });
    expect(screen.getByText(/500/)).toBeTruthy();
  });

  it("kejadian gagal setelah teks parsial → teks parsial tetap ada", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        responsSSE([
          `data: ${JSON.stringify({ jenis: "teks", teks: "jawaban separuh jalan" })}\n\n`,
          `data: ${JSON.stringify({ jenis: "gagal", pesan: "model cadangan juga gagal" })}\n\n`,
          `data: ${JSON.stringify({ jenis: "selesai" })}\n\n`,
        ]),
      ),
    );
    render(<HalamanObrolan />);

    await kirimPesan("halo");

    await waitFor(() => {
      expect(screen.getByText(/model cadangan juga gagal/)).toBeTruthy();
    });
    expect(screen.getByText(/jawaban separuh jalan/)).toBeTruthy();
  });
});
