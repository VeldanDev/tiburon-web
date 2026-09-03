// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PemilihJalur, LATAR_JALUR } from "@/components/chat/PemilihJalur";

describe("PemilihJalur", () => {
  it("menampilkan tiga jalur", () => {
    render(<PemilihJalur jalur="cepat" onGanti={() => {}} />);
    expect(screen.getByText(/Cepat/)).toBeTruthy();
    expect(screen.getByText(/Tiburon/)).toBeTruthy();
    expect(screen.getByText(/Kode/)).toBeTruthy();
  });

  it("memanggil onGanti dengan jalur yang diklik", () => {
    const ganti = vi.fn();
    render(<PemilihJalur jalur="cepat" onGanti={ganti} />);
    fireEvent.click(screen.getByText(/Tiburon/));
    expect(ganti).toHaveBeenCalledWith("tiburon");
  });

  it("tiap jalur punya warna latarnya sendiri", () => {
    expect(LATAR_JALUR.cepat).not.toBe(LATAR_JALUR.tiburon);
    expect(LATAR_JALUR.tiburon).not.toBe(LATAR_JALUR.kode);
  });
});
