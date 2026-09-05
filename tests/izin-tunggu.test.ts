import { describe, it, expect, vi, afterEach } from "vitest";
import {
  BATAS_TUNGGU_MS,
  batalkanIzin,
  jawabIzin,
  jumlahTertunda,
  mintaIzin,
} from "@/lib/izin-tunggu";

const contoh = { jenis: "baca-berkas" as const, sasaran: "D:\\lain\\catatan.md" };

afterEach(() => vi.useRealTimers());

describe("mintaIzin", () => {
  it("menyelesaikan janjinya dengan jawaban yang diberikan", async () => {
    const { id, janji } = mintaIzin(contoh);
    expect(jawabIzin(id, true)).toBe(true);
    await expect(janji).resolves.toBe(true);
  });

  it("menolak juga tersampaikan", async () => {
    const { id, janji } = mintaIzin(contoh);
    jawabIzin(id, false);
    await expect(janji).resolves.toBe(false);
  });

  it("membersihkan dirinya setelah dijawab", async () => {
    const sebelum = jumlahTertunda();
    const { id, janji } = mintaIzin(contoh);
    expect(jumlahTertunda()).toBe(sebelum + 1);
    jawabIzin(id, true);
    await janji;
    expect(jumlahTertunda()).toBe(sebelum);
  });

  it("jawaban kedua diabaikan, tidak melempar", () => {
    // Tombol yang ditekan dua kali cepat, atau jawaban yang datang setelah
    // batas waktu — keduanya wajar dan tidak boleh jadi galat.
    const { id } = mintaIzin(contoh);
    expect(jawabIzin(id, true)).toBe(true);
    expect(jawabIzin(id, true)).toBe(false);
  });

  it("id yang tidak dikenal mengembalikan false, bukan melempar", () => {
    expect(jawabIzin("bukan-id", true)).toBe(false);
  });
});

describe("dua pagar: keduanya berujung TIDAK", () => {
  it("batas waktu menjawab TIDAK, bukan ya", async () => {
    // Izin yang diberikan karena waktu habis adalah izin yang tidak pernah
    // diberikan siapa pun.
    vi.useFakeTimers();
    const { janji } = mintaIzin(contoh);
    vi.advanceTimersByTime(BATAS_TUNGGU_MS + 10);
    await expect(janji).resolves.toBe(false);
  });

  it("pembatalan menjawab TIDAK", async () => {
    // Menekan Esc membatalkan gilirannya; permintaan izin miliknya ikut
    // dibatalkan, bukan ditinggalkan menunggu jawaban untuk pekerjaan yang
    // sudah dihentikan.
    const { id, janji } = mintaIzin(contoh);
    batalkanIzin(id);
    await expect(janji).resolves.toBe(false);
  });

  it("membatalkan yang tidak ada tidak melempar", () => {
    expect(() => batalkanIzin("bukan-id")).not.toThrow();
  });

  it("tidak ada permintaan yang tertinggal setelah batas waktu", async () => {
    // Permintaan yang tidak dibersihkan menumpuk di memori proses yang hidup
    // berhari-hari.
    vi.useFakeTimers();
    const sebelum = jumlahTertunda();
    const { janji } = mintaIzin(contoh);
    vi.advanceTimersByTime(BATAS_TUNGGU_MS + 10);
    await janji;
    expect(jumlahTertunda()).toBe(sebelum);
  });
});
