// Pembersihan DOM otomatis antar-uji komponen.
//
// @testing-library/react versi terpasang (16.3.3) tidak punya sub-ekspor
// "/vitest" yang mendaftarkan afterEach(cleanup) otomatis. Tanpa ini, DOM
// dari satu it() bocor ke it() berikutnya dalam berkas yang sama, dan
// query seperti getByText() gagal dengan "multiple elements found" —
// kegagalan lingkungan, bukan kegagalan fitur.
//
// cleanup() aman dipanggil di berkas uji ber-environment "node": ia hanya
// menyentuh `document` di dalam forEach atas root yang pernah di-render,
// jadi pada berkas tanpa render() ini adalah operasi kosong.
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// Shim App Router untuk uji komponen.
//
// `useRouter` dari next/navigation melempar "invariant expected app router to
// be mounted" di luar server Next.js. Uji komponen berjalan di jsdom polos,
// jadi konteks itu tidak pernah ada.
//
// Yang dipalsukan hanya PERMUKAANNYA, bukan perilakunya: push/replace dicatat
// sebagai vi.fn() supaya uji tetap bisa memeriksa navigasi terjadi, tanpa
// perlu menjalankan router sungguhan.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/app",
  useSearchParams: () => new URLSearchParams(),
}));
